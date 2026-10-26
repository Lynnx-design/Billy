import { requestOtpSchema, verifyOtpSchema } from "@billy/shared";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { parse, type RouteDeps } from "../app";
import { otpCodes, users } from "../db/schema";
import { badRequest, forbidden, tooMany } from "../errors";
import { hashOtp, newOtpCode } from "../lib/ids";
import { toMeDto } from "../services/users";

const OTP_TTL_MS = 10 * 60_000;
const MAX_OTPS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

export async function authRoutes(app: FastifyInstance, { ctx }: RouteDeps) {
  app.post(
    "/auth/otp/request",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (req) => {
      const { phone } = parse(requestOtpSchema, req.body);
      const since = new Date(Date.now() - OTP_TTL_MS);
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(otpCodes)
        .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, since)));
      if (count >= MAX_OTPS_PER_WINDOW) throw tooMany("Too many codes requested. Wait 10 minutes and try again.");

      const [existing] = await ctx.db.select({ status: users.status }).from(users).where(eq(users.phone, phone));
      if (existing?.status === "suspended") throw forbidden("This account is suspended. Contact support.");

      const code = ctx.config.testOtpCode ?? newOtpCode();
      await ctx.db.insert(otpCodes).values({
        phone,
        codeHash: hashOtp(phone, code, ctx.config.jwtSecret),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
      await ctx.sms.send(phone, `Your Billy code is ${code}. It expires in 10 minutes. Don't share it with anyone.`);
      return { ok: true, isNewUser: !existing || existing.status === "deleted" };
    },
  );

  app.post(
    "/auth/otp/verify",
    { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (req) => {
      const { phone, code, acceptTerms } = parse(verifyOtpSchema, req.body);
      const [otp] = await ctx.db
        .select()
        .from(otpCodes)
        .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);
      if (!otp) throw badRequest("This code has expired. Request a new one.", "otp_expired");
      if (otp.attempts >= MAX_ATTEMPTS) throw tooMany("Too many wrong tries. Request a new code.");
      if (otp.codeHash !== hashOtp(phone, code, ctx.config.jwtSecret)) {
        await ctx.db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
        throw badRequest("That code is not right. Check the SMS and try again.", "otp_invalid");
      }

      let [user] = await ctx.db.select().from(users).where(eq(users.phone, phone));
      const isNew = !user;
      if (isNew && !acceptTerms) {
        throw badRequest("Please accept the terms and privacy policy to continue", "terms_required");
      }
      await ctx.db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));

      const role = ctx.config.adminPhones.includes(phone) ? "admin" : "user";
      if (!user) {
        [user] = await ctx.db.insert(users).values({ phone, role, termsAcceptedAt: new Date() }).returning();
      } else if (user.status === "suspended") {
        throw forbidden("This account is suspended. Contact support.");
      } else if (role === "admin" && user.role !== "admin") {
        [user] = await ctx.db.update(users).set({ role }).where(eq(users.id, user.id)).returning();
      }

      const token = await app.jwt.sign({ sub: user.id });
      return { token, user: toMeDto(user), isNew: isNew || !user.username };
    },
  );
}
