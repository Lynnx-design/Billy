import { createBillSchema, PAYABLE_STATUSES, updateBillSchema, type BillStatus } from "@billy/shared";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteDeps } from "../app";
import { billItems, bills, blocks, media, type Bill, type User } from "../db/schema";
import { badRequest, conflict, forbidden, notFound, tooMany } from "../errors";
import { newBillSlug } from "../lib/ids";
import { addEvent, billDetail, expireIfDue, itemsFor, toBillDto } from "../services/bills";

const MAX_BILLS_PER_DAY = 20;
const DAY_MS = 24 * 3600_000;

const listQuery = z.object({
  status: z.enum(["all", "active", "draft", "open", "part_paid", "paid", "declined", "expired", "cancelled"]).default("all"),
});

export async function billRoutes(app: FastifyInstance, { ctx, auth }: RouteDeps) {
  async function ownBill(user: User, id: string): Promise<Bill> {
    if (!z.string().uuid().safeParse(id).success) throw notFound("Bill not found");
    const [bill] = await ctx.db.select().from(bills).where(eq(bills.id, id));
    if (!bill || bill.senderId !== user.id) throw notFound("Bill not found");
    return expireIfDue(ctx, bill);
  }

  async function checkPhotos(user: User, ids: string[] | undefined) {
    if (!ids?.length) return;
    const owned = await ctx.db
      .select({ id: media.id })
      .from(media)
      .where(and(inArray(media.id, ids), eq(media.ownerId, user.id)));
    if (owned.length !== new Set(ids).size) throw badRequest("One of the photos could not be found");
  }

  async function checkNotBlocked(user: User, phone: string | null | undefined) {
    if (!phone) return;
    const [block] = await ctx.db
      .select({ id: blocks.id })
      .from(blocks)
      .where(and(eq(blocks.senderId, user.id), eq(blocks.recipientPhone, phone)));
    if (block) throw forbidden("You can't send bills to this number.");
  }

  function requirePayouts(user: User) {
    if (!user.subaccountCode) {
      throw conflict("Add your bank account first so the money can reach you.", "payouts_required");
    }
  }

  app.get("/bills", async (req) => {
    const user = await auth.requireUser(req);
    const { status } = parse(listQuery, req.query);
    const filter =
      status === "all"
        ? undefined
        : status === "active"
          ? inArray(bills.status, PAYABLE_STATUSES)
          : eq(bills.status, status as BillStatus);
    let rows = await ctx.db
      .select()
      .from(bills)
      .where(filter ? and(eq(bills.senderId, user.id), filter) : eq(bills.senderId, user.id))
      .orderBy(desc(bills.createdAt))
      .limit(200);
    rows = await Promise.all(rows.map((b) => expireIfDue(ctx, b)));
    const items = await itemsFor(ctx.db, rows.map((b) => b.id));

    const [stats] = await ctx.db
      .select({
        receivedKobo: sql<number>`coalesce(sum(${bills.paidKobo}), 0)::int`,
        waitingKobo: sql<number>`coalesce(sum(case when ${bills.status} in ('open','part_paid') then ${bills.totalKobo} - ${bills.paidKobo} else 0 end), 0)::int`,
        activeCount: sql<number>`count(*) filter (where ${bills.status} in ('open','part_paid'))::int`,
        paidCount: sql<number>`count(*) filter (where ${bills.status} = 'paid')::int`,
      })
      .from(bills)
      .where(eq(bills.senderId, user.id));

    return { bills: rows.map((b) => toBillDto(b, items.get(b.id) ?? [])), stats };
  });

  app.post("/bills", async (req, reply) => {
    const user = await auth.requireUser(req);
    const input = parse(createBillSchema, req.body);
    if (!user.name || !user.username) throw conflict("Finish your profile first", "profile_required");
    if (!input.draft) requirePayouts(user);

    const [{ count }] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bills)
      .where(and(eq(bills.senderId, user.id), gt(bills.createdAt, new Date(Date.now() - DAY_MS))));
    if (count >= MAX_BILLS_PER_DAY) throw tooMany(`You can create up to ${MAX_BILLS_PER_DAY} bills a day.`);

    await checkNotBlocked(user, input.recipientPhone);
    await checkPhotos(user, input.photoMediaIds);

    const items = input.items ?? [];
    const totalKobo = items.length ? items.reduce((s, i) => s + i.amountKobo, 0) : input.amountKobo!;
    const bill = await ctx.db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(bills)
        .values({
          slug: newBillSlug(),
          senderId: user.id,
          title: input.title,
          category: input.category,
          relationship: input.relationship,
          note: input.note || null,
          recipientName: input.recipientName || null,
          recipientPhone: input.recipientPhone || null,
          totalKobo,
          allowPartial: input.allowPartial,
          visibility: input.visibility,
          status: input.draft ? "draft" : "open",
          photoMediaIds: input.photoMediaIds ?? [],
          expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS),
        })
        .returning();
      if (items.length) {
        await tx.insert(billItems).values(items.map((i, position) => ({ billId: bill.id, name: i.name, amountKobo: i.amountKobo, position })));
      }
      await addEvent(tx, bill.id, "created");
      if (!input.draft) await addEvent(tx, bill.id, "published");
      return bill;
    });
    reply.status(201);
    return billDetail(ctx, bill);
  });

  app.get<{ Params: { id: string } }>("/bills/:id", async (req) => {
    const user = await auth.requireUser(req);
    return billDetail(ctx, await ownBill(user, req.params.id));
  });

  app.patch<{ Params: { id: string } }>("/bills/:id", async (req) => {
    const user = await auth.requireUser(req);
    const bill = await ownBill(user, req.params.id);
    if (!["draft", "open"].includes(bill.status) || bill.paidKobo > 0) {
      throw conflict("This bill can't be edited any more. Duplicate it to make a new one.", "not_editable");
    }
    const input = parse(updateBillSchema, req.body);
    if (input.recipientPhone) await checkNotBlocked(user, input.recipientPhone);
    await checkPhotos(user, input.photoMediaIds);

    const updated = await ctx.db.transaction(async (tx) => {
      const set: Partial<typeof bills.$inferInsert> = { updatedAt: new Date() };
      for (const key of ["title", "category", "relationship", "allowPartial", "visibility", "photoMediaIds"] as const) {
        if (input[key] !== undefined) (set as Record<string, unknown>)[key] = input[key];
      }
      for (const key of ["note", "recipientName", "recipientPhone"] as const) {
        if (input[key] !== undefined) set[key] = input[key] || null;
      }
      if (input.expiresInDays !== undefined) set.expiresAt = new Date(Date.now() + input.expiresInDays * DAY_MS);
      if (input.items !== undefined) {
        await tx.delete(billItems).where(eq(billItems.billId, bill.id));
        if (input.items.length) {
          await tx
            .insert(billItems)
            .values(input.items.map((i, position) => ({ billId: bill.id, name: i.name, amountKobo: i.amountKobo, position })));
          set.totalKobo = input.items.reduce((s, i) => s + i.amountKobo, 0);
        } else if (input.amountKobo === undefined) {
          throw badRequest("Add an amount or at least one item");
        }
      }
      if (input.amountKobo !== undefined && !input.items?.length) {
        await tx.delete(billItems).where(eq(billItems.billId, bill.id));
        set.totalKobo = input.amountKobo;
      }
      const [updated] = await tx.update(bills).set(set).where(eq(bills.id, bill.id)).returning();
      await addEvent(tx, bill.id, "edited");
      return updated;
    });
    return billDetail(ctx, updated);
  });

  app.post<{ Params: { id: string } }>("/bills/:id/publish", async (req) => {
    const user = await auth.requireUser(req);
    const bill = await ownBill(user, req.params.id);
    if (bill.status !== "draft") throw conflict("Only drafts can be published");
    requirePayouts(user);
    await checkNotBlocked(user, bill.recipientPhone);
    // Keep the same expiry window she chose, counted from now.
    const windowMs = Math.max(DAY_MS, bill.expiresAt.getTime() - bill.createdAt.getTime());
    const [updated] = await ctx.db
      .update(bills)
      .set({ status: "open", expiresAt: new Date(Date.now() + windowMs), updatedAt: new Date() })
      .where(eq(bills.id, bill.id))
      .returning();
    await addEvent(ctx.db, bill.id, "published");
    return billDetail(ctx, updated);
  });

  app.post<{ Params: { id: string } }>("/bills/:id/cancel", async (req) => {
    const user = await auth.requireUser(req);
    const bill = await ownBill(user, req.params.id);
    if (!["draft", "open", "part_paid"].includes(bill.status)) throw conflict("This bill is already closed");
    const [updated] = await ctx.db
      .update(bills)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(bills.id, bill.id))
      .returning();
    await addEvent(ctx.db, bill.id, "cancelled");
    return billDetail(ctx, updated);
  });

  /** Copies a bill into a new draft, e.g. to send the same request again next month. */
  app.post<{ Params: { id: string } }>("/bills/:id/duplicate", async (req, reply) => {
    const user = await auth.requireUser(req);
    const bill = await ownBill(user, req.params.id);
    const items = await ctx.db.select().from(billItems).where(eq(billItems.billId, bill.id));
    const windowMs = Math.max(DAY_MS, bill.expiresAt.getTime() - bill.createdAt.getTime());
    const copy = await ctx.db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(bills)
        .values({
          slug: newBillSlug(),
          senderId: user.id,
          title: bill.title,
          category: bill.category,
          relationship: bill.relationship,
          note: bill.note,
          recipientName: bill.recipientName,
          recipientPhone: bill.recipientPhone,
          totalKobo: bill.totalKobo,
          allowPartial: bill.allowPartial,
          visibility: bill.visibility,
          status: "draft",
          photoMediaIds: bill.photoMediaIds,
          expiresAt: new Date(Date.now() + windowMs),
        })
        .returning();
      if (items.length) {
        await tx.insert(billItems).values(items.map((i) => ({ billId: copy.id, name: i.name, amountKobo: i.amountKobo, position: i.position })));
      }
      await addEvent(tx, copy.id, "created", { duplicatedFrom: bill.id });
      return copy;
    });
    reply.status(201);
    return billDetail(ctx, copy);
  });

  app.delete<{ Params: { id: string } }>("/bills/:id", async (req) => {
    const user = await auth.requireUser(req);
    const bill = await ownBill(user, req.params.id);
    if (bill.status !== "draft") throw conflict("Only drafts can be deleted. Cancel the bill instead.");
    await ctx.db.delete(bills).where(eq(bills.id, bill.id));
    return { ok: true };
  });
}
