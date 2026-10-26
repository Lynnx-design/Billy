import {
  blockSchema,
  declineSchema,
  formatNaira,
  initializePaymentSchema,
  MIN_PAYMENT_KOBO,
  PAYABLE_STATUSES,
  reportSchema,
} from "@billy/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parse, type RouteDeps } from "../app";
import { bills, blocks, payments, reports, users } from "../db/schema";
import { badRequest, conflict, notFound } from "../errors";
import { newPaymentReference } from "../lib/ids";
import { addEvent, applyVerifiedPayment, publicBill } from "../services/bills";
import { notify } from "../services/notifications";

/** Routes for the man paying the bill. None of them need an account. */
export async function payRoutes(app: FastifyInstance, { ctx }: RouteDeps) {
  async function viewerId(req: FastifyRequest): Promise<string | null> {
    try {
      await req.jwtVerify();
      return req.user.sub;
    } catch {
      return null;
    }
  }

  app.get<{ Params: { slug: string } }>(
    "/pay/:slug",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req) => {
      const { bill, dto } = await publicBill(ctx, req.params.slug);
      const track = (req.query as { track?: string }).track !== "0";
      // Count real views only: not her own preview, and not WhatsApp's link-preview robot.
      if (track && (await viewerId(req)) !== bill.senderId) {
        const [first] = await ctx.db
          .update(bills)
          .set({ openedAt: new Date() })
          .where(and(eq(bills.id, bill.id), isNull(bills.openedAt)))
          .returning({ id: bills.id });
        await ctx.db.update(bills).set({ viewCount: sql`${bills.viewCount} + 1` }).where(eq(bills.id, bill.id));
        if (first) {
          await addEvent(ctx.db, bill.id, "opened");
          await notify(ctx, {
            userId: bill.senderId,
            billId: bill.id,
            type: "bill_opened",
            title: "Your bill was opened 👀",
            body: `${bill.recipientName ?? "Someone"} just opened "${bill.title}".`,
          });
        }
      }
      return dto;
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/pay/:slug/initialize",
    { config: { rateLimit: { max: 15, timeWindow: "10 minutes" } } },
    async (req) => {
      const input = parse(initializePaymentSchema, req.body);
      const { bill, dto } = await publicBill(ctx, req.params.slug);
      if (!dto.payable) throw conflict(dto.notPayableReason ?? "This bill can't be paid", "not_payable");

      const remaining = dto.remainingKobo;
      if (input.amountKobo > remaining) throw badRequest(`The most you can pay is ${formatNaira(remaining)}`);
      if (!bill.allowPartial && input.amountKobo !== remaining) {
        throw badRequest(`This bill must be paid in full: ${formatNaira(remaining)}`);
      }
      const minimum = Math.min(MIN_PAYMENT_KOBO, remaining);
      if (input.amountKobo < minimum) throw badRequest(`The least you can pay is ${formatNaira(minimum)}`);

      const [sender] = await ctx.db.select().from(users).where(eq(users.id, bill.senderId));
      const reference = newPaymentReference();
      // Paystack needs an email. If he skips it, use a placeholder so he isn't forced to share one.
      const email = input.payerEmail || `payer+${reference.toLowerCase()}@pay.billy.ng`;
      await ctx.db.insert(payments).values({
        billId: bill.id,
        reference,
        provider: ctx.payments.name,
        amountKobo: input.amountKobo,
        payerName: input.payerName,
        payerEmail: input.payerEmail || null,
        payerPhone: input.payerPhone || null,
        message: input.message || null,
      });
      const { authorizationUrl } = await ctx.payments.initialize({
        reference,
        amountKobo: input.amountKobo,
        email,
        subaccountCode: sender.subaccountCode!,
        callbackUrl: `${ctx.config.webUrl}/b/${bill.slug}/done?reference=${encodeURIComponent(reference)}`,
        metadata: { billId: bill.id, slug: bill.slug, payerName: input.payerName },
      });
      await addEvent(ctx.db, bill.id, "payment_started", { amountKobo: input.amountKobo, payerName: input.payerName });
      return { reference, authorizationUrl };
    },
  );

  /** Called when he lands back on Billy after paying. The webhook usually gets there first. */
  app.get<{ Params: { slug: string }; Querystring: { reference?: string } }>(
    "/pay/:slug/verify",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => {
      const reference = z.string().min(5).max(80).parse(req.query.reference);
      const [row] = await ctx.db
        .select({ payment: payments, slug: bills.slug })
        .from(payments)
        .innerJoin(bills, eq(bills.id, payments.billId))
        .where(eq(payments.reference, reference));
      if (!row || row.slug !== req.params.slug) throw notFound("Payment not found");

      let payment = row.payment;
      if (payment.status === "pending") {
        const verified = await ctx.payments.verify(reference);
        await applyVerifiedPayment(ctx, reference, verified);
        [payment] = await ctx.db.select().from(payments).where(eq(payments.id, payment.id));
      }
      const { dto } = await publicBill(ctx, req.params.slug);
      return {
        payment: {
          reference: payment.reference,
          status: payment.status,
          amountKobo: payment.amountKobo,
          channel: payment.channel,
          payerName: payment.payerName,
          paidAt: payment.paidAt?.toISOString() ?? null,
        },
        bill: dto,
      };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/pay/:slug/decline",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (req) => {
      const { reason } = parse(declineSchema, req.body);
      const { bill } = await publicBill(ctx, req.params.slug);
      const [updated] = await ctx.db
        .update(bills)
        .set({ status: "declined", declineReason: reason || null, updatedAt: new Date() })
        .where(and(eq(bills.id, bill.id), inArray(bills.status, PAYABLE_STATUSES)))
        .returning();
      if (!updated) throw conflict("This bill is already closed");
      await addEvent(ctx.db, bill.id, "declined", { reason: reason || null });
      await notify(ctx, {
        userId: bill.senderId,
        billId: bill.id,
        type: "bill_declined",
        title: "Bill declined",
        body: `"${bill.title}" was declined${reason ? `: "${reason}"` : "."}`,
      });
      return { ok: true };
    },
  );

  /** He asks never to get bills from this sender again. Also declines this bill. */
  app.post<{ Params: { slug: string } }>(
    "/pay/:slug/block",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (req) => {
      const { bill } = await publicBill(ctx, req.params.slug);
      const phone = bill.recipientPhone ?? parse(blockSchema, req.body).phone;
      await ctx.db.insert(blocks).values({ senderId: bill.senderId, recipientPhone: phone }).onConflictDoNothing();
      // Close every open bill she sent to this number.
      const closed = await ctx.db
        .update(bills)
        .set({ status: "declined", updatedAt: new Date() })
        .where(and(eq(bills.senderId, bill.senderId), eq(bills.recipientPhone, phone), inArray(bills.status, PAYABLE_STATUSES)))
        .returning({ id: bills.id });
      if (!closed.some((b) => b.id === bill.id)) {
        await ctx.db
          .update(bills)
          .set({ status: "declined", updatedAt: new Date() })
          .where(and(eq(bills.id, bill.id), inArray(bills.status, PAYABLE_STATUSES)));
      }
      await addEvent(ctx.db, bill.id, "blocked");
      await notify(ctx, {
        userId: bill.senderId,
        billId: bill.id,
        type: "bill_blocked",
        title: "Bill declined",
        body: `"${bill.title}" was declined, and the recipient asked not to get more bills from you.`,
      });
      return { ok: true };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/pay/:slug/report",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (req) => {
      const input = parse(reportSchema, req.body);
      const { bill } = await publicBill(ctx, req.params.slug);
      await ctx.db.insert(reports).values({
        billId: bill.id,
        reportedUserId: bill.senderId,
        reason: input.reason,
        details: input.details || null,
        contact: input.contact || null,
      });
      return { ok: true };
    },
  );
}
