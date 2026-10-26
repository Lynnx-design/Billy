import {
  buildShareMessage,
  formatNaira,
  PAYABLE_STATUSES,
  type BillDetailDto,
  type BillDto,
  type BillEventType,
  type BillStatus,
  type PublicBillDto,
} from "@billy/shared";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { AppContext } from "../context";
import type { Db } from "../db";
import { billEvents, billItems, bills, payments, users, type Bill, type BillItem } from "../db/schema";
import { notFound } from "../errors";
import { notify } from "./notifications";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbOrTx = Db | Tx;

export const mediaUrl = (id: string) => `/media/${id}`;

export function toBillDto(bill: Bill, items: BillItem[]): BillDto {
  return {
    id: bill.id,
    slug: bill.slug,
    title: bill.title,
    category: bill.category,
    relationship: bill.relationship,
    note: bill.note,
    recipientName: bill.recipientName,
    recipientPhone: bill.recipientPhone,
    totalKobo: bill.totalKobo,
    paidKobo: bill.paidKobo,
    allowPartial: bill.allowPartial,
    visibility: bill.visibility,
    status: bill.status,
    items: items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, name: i.name, amountKobo: i.amountKobo })),
    photoUrls: bill.photoMediaIds.map(mediaUrl),
    photoMediaIds: bill.photoMediaIds,
    expiresAt: bill.expiresAt.toISOString(),
    openedAt: bill.openedAt?.toISOString() ?? null,
    viewCount: bill.viewCount,
    declineReason: bill.declineReason,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

export async function itemsFor(db: DbOrTx, billIds: string[]) {
  if (billIds.length === 0) return new Map<string, BillItem[]>();
  const rows = await db.select().from(billItems).where(inArray(billItems.billId, billIds));
  const map = new Map<string, BillItem[]>();
  for (const row of rows) map.set(row.billId, [...(map.get(row.billId) ?? []), row]);
  return map;
}

export async function addEvent(db: DbOrTx, billId: string, type: BillEventType, data?: Record<string, unknown>) {
  await db.insert(billEvents).values({ billId, type, data: data ?? null });
}

export function shareUrl(ctx: AppContext, slug: string) {
  return `${ctx.config.webUrl}/b/${slug}`;
}

export async function billDetail(ctx: AppContext, bill: Bill): Promise<BillDetailDto> {
  const [items, events, pays] = await Promise.all([
    ctx.db.select().from(billItems).where(eq(billItems.billId, bill.id)),
    ctx.db.select().from(billEvents).where(eq(billEvents.billId, bill.id)).orderBy(asc(billEvents.createdAt)),
    ctx.db.select().from(payments).where(eq(payments.billId, bill.id)).orderBy(desc(payments.createdAt)),
  ]);
  const url = shareUrl(ctx, bill.slug);
  return {
    ...toBillDto(bill, items),
    events: events.map((e) => ({
      id: e.id,
      type: e.type as BillEventType,
      data: e.data ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    payments: pays.map((p) => ({
      id: p.id,
      reference: p.reference,
      amountKobo: p.amountKobo,
      status: p.status,
      channel: p.channel,
      payerName: p.payerName,
      message: p.message,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    shareUrl: url,
    shareMessage: buildShareMessage({
      category: bill.category,
      relationship: bill.relationship,
      recipientName: bill.recipientName,
      title: bill.title,
      amount: formatNaira(bill.totalKobo - bill.paidKobo),
      link: url,
    }),
  };
}

/** Marks a bill expired if its time has passed. Returns the up-to-date bill. */
export async function expireIfDue(ctx: AppContext, bill: Bill): Promise<Bill> {
  if (!PAYABLE_STATUSES.includes(bill.status) || bill.expiresAt > new Date()) return bill;
  const [updated] = await ctx.db
    .update(bills)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(bills.id, bill.id), inArray(bills.status, PAYABLE_STATUSES)))
    .returning();
  if (!updated) return (await ctx.db.select().from(bills).where(eq(bills.id, bill.id)))[0];
  await addEvent(ctx.db, bill.id, "expired");
  await notify(ctx, {
    userId: bill.senderId,
    billId: bill.id,
    type: "bill_expired",
    title: "Bill expired",
    body: `"${bill.title}" expired${bill.paidKobo > 0 ? ` with ${formatNaira(bill.paidKobo)} paid` : ""}.`,
  });
  return updated;
}

/** Expires every overdue bill. Runs on a timer in the server. */
export async function expireDueBills(ctx: AppContext): Promise<number> {
  const due = await ctx.db
    .select()
    .from(bills)
    .where(and(inArray(bills.status, PAYABLE_STATUSES), lt(bills.expiresAt, new Date())))
    .limit(500);
  for (const bill of due) await expireIfDue(ctx, bill);
  return due.length;
}

export async function publicBill(ctx: AppContext, slug: string): Promise<{ bill: Bill; dto: PublicBillDto }> {
  const [row] = await ctx.db
    .select({ bill: bills, sender: users })
    .from(bills)
    .innerJoin(users, eq(users.id, bills.senderId))
    .where(eq(bills.slug, slug));
  if (!row || row.bill.status === "draft" || row.sender.status === "deleted") throw notFound("This bill doesn't exist");
  const bill = await expireIfDue(ctx, row.bill);
  const items = await ctx.db.select().from(billItems).where(eq(billItems.billId, bill.id));
  const remainingKobo = Math.max(0, bill.totalKobo - bill.paidKobo);

  let notPayableReason: string | null = null;
  if (row.sender.status === "suspended") notPayableReason = "This account is under review, so this bill can't be paid right now.";
  else if (!row.sender.subaccountCode) notPayableReason = `${row.sender.name ?? "She"} hasn't finished setting up payouts yet.`;
  else if (!PAYABLE_STATUSES.includes(bill.status)) notPayableReason = notPayableMessage(bill.status);

  const base = toBillDto(bill, items);
  return {
    bill,
    dto: {
      slug: bill.slug,
      title: bill.title,
      category: bill.category,
      note: bill.note,
      recipientName: bill.recipientName,
      totalKobo: bill.totalKobo,
      paidKobo: bill.paidKobo,
      remainingKobo,
      allowPartial: bill.allowPartial,
      status: bill.status,
      items: base.items,
      photoUrls: base.photoUrls,
      expiresAt: base.expiresAt,
      payable: notPayableReason === null,
      notPayableReason,
      sender: {
        name: row.sender.name ?? "Billy user",
        username: row.sender.username,
        avatarUrl: row.sender.avatarMediaId ? mediaUrl(row.sender.avatarMediaId) : null,
      },
    },
  };
}

function notPayableMessage(status: BillStatus): string {
  switch (status) {
    case "paid":
      return "This bill has been paid in full. Thank you!";
    case "declined":
      return "This bill was declined.";
    case "expired":
      return "This bill has expired.";
    case "cancelled":
      return "This bill was cancelled.";
    default:
      return "This bill can't be paid right now.";
  }
}

/**
 * Records a confirmed payment exactly once, whether it arrives from the Paystack webhook,
 * the redirect back to Billy, or both.
 */
export async function applyVerifiedPayment(
  ctx: AppContext,
  reference: string,
  verified: { status: "success" | "failed" | "pending"; amountKobo: number; channel: string | null; paidAt: Date | null },
) {
  if (verified.status === "pending") return { applied: false as const };

  const result = await ctx.db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.reference, reference))
      .for("update");
    if (!payment || payment.status !== "pending") return null;

    if (verified.status === "failed") {
      await tx.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
      return null;
    }

    // Trust the amount the gateway confirms, not the amount we asked for.
    const amount = verified.amountKobo;
    await tx
      .update(payments)
      .set({ status: "success", amountKobo: amount, channel: verified.channel, paidAt: verified.paidAt ?? new Date() })
      .where(eq(payments.id, payment.id));

    const [bill] = await tx
      .update(bills)
      .set({
        paidKobo: sql`${bills.paidKobo} + ${amount}`,
        status: sql`case when ${bills.paidKobo} + ${amount} >= ${bills.totalKobo} then 'paid'::bill_status else 'part_paid'::bill_status end`,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, payment.billId))
      .returning();

    await addEvent(tx, bill.id, bill.status === "paid" ? "paid" : "part_paid", {
      amountKobo: amount,
      payerName: payment.payerName,
      channel: verified.channel,
    });
    return { bill, payment: { ...payment, amountKobo: amount } };
  });

  if (!result) return { applied: false as const };
  const { bill, payment } = result;
  const fully = bill.status === "paid";
  const title = fully ? "Bill paid in full 🎉" : "You got a part payment";
  const body = fully
    ? `${payment.payerName} paid ${formatNaira(payment.amountKobo)} for "${bill.title}". It's fully paid!`
    : `${payment.payerName} paid ${formatNaira(payment.amountKobo)} for "${bill.title}". ${formatNaira(bill.totalKobo - bill.paidKobo)} left.`;
  await notify(ctx, { userId: bill.senderId, billId: bill.id, type: fully ? "bill_paid" : "bill_part_paid", title, body, sms: true });
  return { applied: true as const, bill };
}
