import { eq } from "drizzle-orm";
import type { AppContext } from "../context";
import { notifications, users } from "../db/schema";

/** Saves an in-app notification and, for important events, also sends an SMS. */
export async function notify(
  ctx: AppContext,
  n: { userId: string; billId?: string | null; type: string; title: string; body: string; sms?: boolean },
) {
  await ctx.db.insert(notifications).values({
    userId: n.userId,
    billId: n.billId ?? null,
    type: n.type,
    title: n.title,
    body: n.body,
  });
  if (!n.sms) return;
  const [user] = await ctx.db.select({ phone: users.phone, status: users.status }).from(users).where(eq(users.id, n.userId));
  if (!user || user.status === "deleted") return;
  // An SMS failure should never undo a payment or block the request.
  await ctx.sms.send(user.phone, `Billy: ${n.body}`).catch(() => {});
}
