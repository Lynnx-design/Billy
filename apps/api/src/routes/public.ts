import { and, desc, eq, gt, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "../app";
import { bills, users } from "../db/schema";
import { notFound } from "../errors";
import { itemsFor, mediaUrl, toBillDto } from "../services/bills";

export async function publicRoutes(app: FastifyInstance, { ctx }: RouteDeps) {
  /** Her personal page (billy.ng/ada): profile and any bills she made public. */
  app.get<{ Params: { username: string } }>("/users/:username", async (req) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(and(eq(users.username, req.params.username.toLowerCase()), eq(users.status, "active")));
    if (!user) throw notFound("We couldn't find that person");
    const rows = await ctx.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.senderId, user.id),
          eq(bills.visibility, "public"),
          inArray(bills.status, ["open", "part_paid"]),
          gt(bills.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(bills.createdAt))
      .limit(50);
    const items = await itemsFor(ctx.db, rows.map((b) => b.id));
    return {
      name: user.name,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatarMediaId ? mediaUrl(user.avatarMediaId) : null,
      payoutsReady: !!user.subaccountCode,
      bills: rows.map((b) => {
        const dto = toBillDto(b, items.get(b.id) ?? []);
        return {
          slug: dto.slug,
          title: dto.title,
          category: dto.category,
          totalKobo: dto.totalKobo,
          paidKobo: dto.paidKobo,
          photoUrls: dto.photoUrls,
          expiresAt: dto.expiresAt,
        };
      }),
    };
  });
}
