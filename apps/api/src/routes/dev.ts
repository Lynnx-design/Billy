import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteDeps } from "../app";
import { notFound } from "../errors";
import type { MockPaymentProvider } from "../providers/payments";
import { applyVerifiedPayment } from "../services/bills";

const completeSchema = z.object({
  reference: z.string().min(5),
  outcome: z.enum(["success", "failed"]),
  channel: z.enum(["bank_transfer", "card", "ussd"]).default("bank_transfer"),
});

/** Only registered when no Paystack key is set and NODE_ENV is not production. */
export async function devRoutes(app: FastifyInstance, { ctx }: RouteDeps, mock: MockPaymentProvider) {
  app.post("/dev/test-checkout/complete", async (req) => {
    const { reference, outcome, channel } = parse(completeSchema, req.body);
    if (!mock.complete(reference, outcome, channel)) throw notFound("Unknown payment reference");
    await applyVerifiedPayment(ctx, reference, await mock.verify(reference));
    return { ok: true };
  });
}
