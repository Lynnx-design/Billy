import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "../app";
import { applyVerifiedPayment } from "../services/bills";

interface PaystackEvent {
  event: string;
  data?: { reference?: string };
}

export async function webhookRoutes(app: FastifyInstance, { ctx }: RouteDeps) {
  app.post("/webhooks/paystack", async (req, reply) => {
    const signature = req.headers["x-paystack-signature"];
    if (!ctx.payments.verifyWebhookSignature(req.rawBody ?? "", typeof signature === "string" ? signature : undefined)) {
      return reply.status(401).send({ error: "invalid_signature", message: "Invalid signature" });
    }
    const event = req.body as PaystackEvent;
    const reference = event.data?.reference;
    if (reference && (event.event === "charge.success" || event.event === "charge.failed")) {
      // Never trust the webhook body for the amount: ask Paystack directly.
      const verified = await ctx.payments.verify(reference);
      await applyVerifiedPayment(ctx, reference, verified);
    }
    return { ok: true };
  });
}
