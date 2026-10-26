import { bankAccountSchema, updateProfileSchema, type NotificationDto } from "@billy/shared";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { parse, type RouteDeps } from "../app";
import { billEvents, billItems, bills, blocks, media, notifications, payments, users } from "../db/schema";
import { badRequest, conflict } from "../errors";
import { addEvent } from "../services/bills";
import { RESERVED_USERNAMES, toMeDto } from "../services/users";

export async function meRoutes(app: FastifyInstance, { ctx, auth }: RouteDeps) {
  app.get("/me", async (req) => toMeDto(await auth.requireUser(req)));

  app.patch("/me", async (req) => {
    const user = await auth.requireUser(req);
    const input = parse(updateProfileSchema, req.body);
    if (input.username !== undefined && input.username !== user.username) {
      if (RESERVED_USERNAMES.has(input.username)) throw conflict("That username is taken", "username_taken");
      const [taken] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, input.username), ne(users.id, user.id)));
      if (taken) throw conflict("That username is taken", "username_taken");
    }
    if (input.avatarMediaId) {
      const [m] = await ctx.db
        .select({ id: media.id })
        .from(media)
        .where(and(eq(media.id, input.avatarMediaId), eq(media.ownerId, user.id)));
      if (!m) throw badRequest("Photo not found");
    }
    const [updated] = await ctx.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return toMeDto(updated);
  });

  app.get("/banks", async () => ({ banks: await ctx.payments.listBanks() }));

  /** Looks up the account name so she can confirm it before saving. */
  app.post(
    "/me/bank-account/resolve",
    { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (req) => {
      await auth.requireUser(req);
      const { bankCode, accountNumber } = parse(bankAccountSchema, req.body);
      return ctx.payments.resolveAccount(accountNumber, bankCode);
    },
  );

  /** Saves her payout bank account and links it to Paystack so payments settle straight to her. */
  app.put(
    "/me/bank-account",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (req) => {
      const user = await auth.requireUser(req);
      const { bankCode, accountNumber } = parse(bankAccountSchema, req.body);
      const banks = await ctx.payments.listBanks();
      const bank = banks.find((b) => b.code === bankCode);
      if (!bank) throw badRequest("Choose a bank from the list");
      const { accountName } = await ctx.payments.resolveAccount(accountNumber, bankCode);
      const businessName = `Billy - ${user.name ?? accountName}`.slice(0, 100);

      let subaccountCode = user.subaccountCode;
      if (subaccountCode) {
        await ctx.payments.updateSubaccount(subaccountCode, { bankCode, accountNumber, businessName });
      } else {
        ({ subaccountCode } = await ctx.payments.createSubaccount({
          businessName,
          bankCode,
          accountNumber,
          percentageCharge: ctx.config.billyFeePercent,
        }));
      }
      const [updated] = await ctx.db
        .update(users)
        .set({ bankCode, bankName: bank.name, accountNumber, accountName, subaccountCode, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return toMeDto(updated);
    },
  );

  app.get("/me/notifications", async (req) => {
    const user = await auth.requireUser(req);
    const rows = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    const [{ unread }] = await ctx.db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    const items: NotificationDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      billId: n.billId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
    return { items, unread };
  });

  app.post("/me/notifications/read", async (req) => {
    const user = await auth.requireUser(req);
    await ctx.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return { ok: true };
  });

  app.get("/me/blocks", async (req) => {
    const user = await auth.requireUser(req);
    const rows = await ctx.db.select().from(blocks).where(eq(blocks.senderId, user.id));
    return { count: rows.length };
  });

  /** Everything Billy stores about her, as JSON (NDPR data access). */
  app.get("/me/export", async (req, reply) => {
    const user = await auth.requireUser(req);
    const myBills = await ctx.db.select().from(bills).where(eq(bills.senderId, user.id));
    const ids = myBills.map((b) => b.id);
    const [items, events, pays, notes] = await Promise.all([
      ids.length ? ctx.db.select().from(billItems).where(inArray(billItems.billId, ids)) : [],
      ids.length ? ctx.db.select().from(billEvents).where(inArray(billEvents.billId, ids)) : [],
      ids.length ? ctx.db.select().from(payments).where(inArray(payments.billId, ids)) : [],
      ctx.db.select().from(notifications).where(eq(notifications.userId, user.id)),
    ]);
    const { subaccountCode: _s, ...profile } = user;
    reply.header("Content-Disposition", 'attachment; filename="billy-data.json"');
    return { exportedAt: new Date().toISOString(), profile, bills: myBills, billItems: items, billEvents: events, payments: pays, notifications: notes };
  });

  /** Deletes her account: open bills are cancelled and personal details are wiped. */
  app.delete("/me", async (req) => {
    const user = await auth.requireUser(req);
    await ctx.db.transaction(async (tx) => {
      const open = await tx
        .update(bills)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(bills.senderId, user.id), inArray(bills.status, ["draft", "open", "part_paid"])))
        .returning({ id: bills.id });
      for (const b of open) await addEvent(tx, b.id, "cancelled", { reason: "account_deleted" });
      await tx.delete(media).where(eq(media.ownerId, user.id));
      await tx.delete(notifications).where(eq(notifications.userId, user.id));
      await tx
        .update(users)
        .set({
          status: "deleted",
          phone: `deleted:${user.id}`,
          name: null,
          username: null,
          bio: null,
          avatarMediaId: null,
          bankCode: null,
          bankName: null,
          accountNumber: null,
          accountName: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    });
    return { ok: true };
  });
}
