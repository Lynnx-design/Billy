import { maskPhone } from "@billy/shared";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse, type RouteDeps } from "../app";
import { bills, payments, reports, users } from "../db/schema";
import { notFound } from "../errors";

const searchQuery = z.object({ q: z.string().trim().max(60).optional() });
const idParam = z.object({ id: z.string().uuid() });

export async function adminRoutes(app: FastifyInstance, { ctx, auth }: RouteDeps) {
  app.get("/admin/stats", async (req) => {
    await auth.requireAdmin(req);
    const [u] = await ctx.db
      .select({
        total: sql<number>`count(*) filter (where ${users.status} <> 'deleted')::int`,
        withPayouts: sql<number>`count(*) filter (where ${users.subaccountCode} is not null and ${users.status} = 'active')::int`,
        suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
      })
      .from(users);
    const [b] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${bills.status} in ('open','part_paid'))::int`,
        paid: sql<number>`count(*) filter (where ${bills.status} = 'paid')::int`,
        declined: sql<number>`count(*) filter (where ${bills.status} = 'declined')::int`,
        requestedKobo: sql<number>`coalesce(sum(${bills.totalKobo}) filter (where ${bills.status} <> 'draft'), 0)::bigint`,
      })
      .from(bills);
    const [p] = await ctx.db
      .select({
        successful: sql<number>`count(*) filter (where ${payments.status} = 'success')::int`,
        failed: sql<number>`count(*) filter (where ${payments.status} = 'failed')::int`,
        volumeKobo: sql<number>`coalesce(sum(${payments.amountKobo}) filter (where ${payments.status} = 'success'), 0)::bigint`,
      })
      .from(payments);
    const [r] = await ctx.db
      .select({ open: sql<number>`count(*) filter (where ${reports.status} = 'open')::int` })
      .from(reports);
    return {
      users: u,
      bills: { ...b, requestedKobo: Number(b.requestedKobo) },
      payments: { ...p, volumeKobo: Number(p.volumeKobo) },
      reports: r,
    };
  });

  app.get("/admin/users", async (req) => {
    await auth.requireAdmin(req);
    const { q } = parse(searchQuery, req.query);
    const where = q ? or(ilike(users.name, `%${q}%`), ilike(users.username, `%${q}%`), ilike(users.phone, `%${q}%`)) : undefined;
    const rows = await ctx.db
      .select({
        id: users.id,
        phone: users.phone,
        name: users.name,
        username: users.username,
        role: users.role,
        status: users.status,
        payoutsReady: sql<boolean>`${users.subaccountCode} is not null`,
        createdAt: users.createdAt,
        billCount: sql<number>`(select count(*)::int from bills where bills.sender_id = ${users.id})`,
        reportCount: sql<number>`(select count(*)::int from reports where reports.reported_user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(100);
    return { users: rows.map((u) => ({ ...u, phone: u.phone.startsWith("+") ? maskPhone(u.phone) : "deleted" })) };
  });

  async function setStatus(id: string, status: "active" | "suspended") {
    const [user] = await ctx.db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    if (!user) throw notFound("User not found");
    return { ok: true, status: user.status };
  }

  app.post("/admin/users/:id/suspend", async (req) => {
    await auth.requireAdmin(req);
    return setStatus(parse(idParam, req.params).id, "suspended");
  });

  app.post("/admin/users/:id/unsuspend", async (req) => {
    await auth.requireAdmin(req);
    return setStatus(parse(idParam, req.params).id, "active");
  });

  app.get("/admin/bills", async (req) => {
    await auth.requireAdmin(req);
    const rows = await ctx.db
      .select({
        id: bills.id,
        slug: bills.slug,
        title: bills.title,
        status: bills.status,
        totalKobo: bills.totalKobo,
        paidKobo: bills.paidKobo,
        createdAt: bills.createdAt,
        senderName: users.name,
        senderUsername: users.username,
      })
      .from(bills)
      .innerJoin(users, eq(users.id, bills.senderId))
      .orderBy(desc(bills.createdAt))
      .limit(100);
    return { bills: rows };
  });

  app.get("/admin/payments", async (req) => {
    await auth.requireAdmin(req);
    const rows = await ctx.db
      .select({
        id: payments.id,
        reference: payments.reference,
        provider: payments.provider,
        status: payments.status,
        amountKobo: payments.amountKobo,
        channel: payments.channel,
        payerName: payments.payerName,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
        billTitle: bills.title,
        billSlug: bills.slug,
      })
      .from(payments)
      .innerJoin(bills, eq(bills.id, payments.billId))
      .orderBy(desc(payments.createdAt))
      .limit(100);
    return { payments: rows };
  });

  app.get("/admin/reports", async (req) => {
    await auth.requireAdmin(req);
    const rows = await ctx.db
      .select({
        id: reports.id,
        reason: reports.reason,
        details: reports.details,
        contact: reports.contact,
        status: reports.status,
        createdAt: reports.createdAt,
        billSlug: bills.slug,
        billTitle: bills.title,
        reportedUserId: reports.reportedUserId,
        reportedName: users.name,
        reportedUsername: users.username,
        reportedStatus: users.status,
      })
      .from(reports)
      .leftJoin(bills, eq(bills.id, reports.billId))
      .leftJoin(users, eq(users.id, reports.reportedUserId))
      .orderBy(desc(reports.createdAt))
      .limit(100);
    return { reports: rows };
  });

  app.post("/admin/reports/:id/resolve", async (req) => {
    await auth.requireAdmin(req);
    const { id } = parse(idParam, req.params);
    const [row] = await ctx.db.update(reports).set({ status: "resolved" }).where(eq(reports.id, id)).returning();
    if (!row) throw notFound("Report not found");
    return { ok: true };
  });
}
