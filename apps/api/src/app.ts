import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { Config } from "./config";
import type { AppContext } from "./context";
import { createDb } from "./db";
import { users, type User } from "./db/schema";
import { forbidden, HttpError, unauthorized } from "./errors";
import { MockPaymentProvider, PaystackProvider, type PaymentProvider } from "./providers/payments";
import { ConsoleSmsProvider, TermiiSmsProvider, type SmsProvider } from "./providers/sms";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { billRoutes } from "./routes/bills";
import { devRoutes } from "./routes/dev";
import { meRoutes } from "./routes/me";
import { mediaRoutes } from "./routes/media";
import { payRoutes } from "./routes/pay";
import { publicRoutes } from "./routes/public";
import { webhookRoutes } from "./routes/webhooks";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
    currentUser?: User;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export interface BuildOptions {
  config: Config;
  payments?: PaymentProvider;
  sms?: SmsProvider;
  logger?: boolean;
  /** Turns off per-IP rate limits (tests send everything from one address). */
  disableRateLimit?: boolean;
}

export async function buildApp(opts: BuildOptions) {
  const { config } = opts;
  const app = Fastify({
    logger: opts.logger ?? true,
    bodyLimit: 3 * 1024 * 1024,
    trustProxy: true,
  });
  const { db, pool } = createDb(config.databaseUrl);
  app.addHook("onClose", async () => pool.end());

  const payments =
    opts.payments ??
    (config.paystackSecretKey ? new PaystackProvider(config.paystackSecretKey) : new MockPaymentProvider(config.webUrl));
  const sms =
    opts.sms ??
    (config.termiiApiKey ? new TermiiSmsProvider(config.termiiApiKey, config.termiiSenderId, app.log) : new ConsoleSmsProvider(app.log));
  if (config.isProduction && payments.name === "mock") app.log.warn("PAYSTACK_SECRET_KEY is not set: using the test checkout");

  const ctx: AppContext = { config, db, payments, sms };

  // Keep the raw JSON text so Paystack webhook signatures can be checked.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const text = body as string;
    (req as FastifyRequest).rawBody = text;
    if (!text) return done(null, {});
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new HttpError(400, "invalid_json", "Invalid JSON"), undefined);
    }
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: "30d" } });
  await app.register(rateLimit, { global: false, allowList: () => !!opts.disableRateLimit });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        message: err.issues[0]?.message ?? "Invalid input",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: "too_many_requests", message: "Too many requests, please slow down" });
    if (status < 500) return reply.status(status).send({ error: "bad_request", message: (err as Error).message });
    req.log.error(err);
    return reply.status(500).send({ error: "server_error", message: "Something went wrong on our side" });
  });

  app.get("/health", async () => ({ ok: true, payments: payments.name }));

  const deps = { ctx, auth: makeAuth(ctx) };
  await app.register(async (r) => authRoutes(r, deps));
  await app.register(async (r) => meRoutes(r, deps));
  await app.register(async (r) => billRoutes(r, deps));
  await app.register(async (r) => payRoutes(r, deps));
  await app.register(async (r) => publicRoutes(r, deps));
  await app.register(async (r) => mediaRoutes(r, deps));
  await app.register(async (r) => webhookRoutes(r, deps));
  await app.register(async (r) => adminRoutes(r, deps));
  if (payments instanceof MockPaymentProvider && !config.isProduction) {
    await app.register(async (r) => devRoutes(r, deps, payments));
  }

  return { app, ctx };
}

function makeAuth(ctx: AppContext) {
  async function requireUser(req: FastifyRequest): Promise<User> {
    if (req.currentUser) return req.currentUser;
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized();
    }
    const [user] = await ctx.db.select().from(users).where(eq(users.id, req.user.sub));
    if (!user || user.status === "deleted") throw unauthorized();
    if (user.status === "suspended") throw forbidden("Your account is suspended. Contact support.");
    req.currentUser = user;
    return user;
  }

  async function requireAdmin(req: FastifyRequest): Promise<User> {
    const user = await requireUser(req);
    if (user.role !== "admin") throw forbidden();
    return user;
  }

  return { requireUser, requireAdmin };
}

export type Auth = ReturnType<typeof makeAuth>;
export interface RouteDeps {
  ctx: AppContext;
  auth: Auth;
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data ?? {});
}
