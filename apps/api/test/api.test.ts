import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bills } from "../src/db/schema";
import { expireDueBills } from "../src/services/bills";
import { OTP, resetDb, setup } from "./helpers";

let t: Awaited<ReturnType<typeof setup>>;

beforeAll(async () => {
  await resetDb();
  t = await setup();
});

afterAll(async () => {
  await t.app.close();
});

async function createBill(headers: Record<string, string>, payload: Record<string, unknown> = {}) {
  const res = await t.app.inject({
    method: "POST",
    url: "/bills",
    headers,
    payload: { title: "Hair appointment", category: "hair", relationship: "partner", amountKobo: 2_500_000, ...payload },
  });
  return res;
}

async function pay(slug: string, amountKobo: number, outcome: "success" | "failed" = "success") {
  const init = await t.app.inject({
    method: "POST",
    url: `/pay/${slug}/initialize`,
    payload: { amountKobo, payerName: "Tunde" },
  });
  expect(init.statusCode, init.body).toBe(200);
  const { reference, authorizationUrl } = init.json();
  expect(authorizationUrl).toContain("/test-checkout");
  await t.app.inject({ method: "POST", url: "/dev/test-checkout/complete", payload: { reference, outcome } });
  return reference as string;
}

describe("auth", () => {
  it("rejects bad phone numbers", async () => {
    const res = await t.app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "12345" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Nigerian phone/);
  });

  it("sends an OTP by SMS and logs in", async () => {
    const res = await t.app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "0803 111 2222" } });
    expect(res.json()).toEqual({ ok: true, isNewUser: true });
    expect(t.sms.sent.at(-1)).toMatchObject({ to: "+2348031112222" });
    expect(t.sms.sent.at(-1)!.message).toContain(OTP);

    const noTerms = await t.app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "08031112222", code: OTP } });
    expect(noTerms.json().error).toBe("terms_required");

    const wrong = await t.app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phone: "08031112222", code: "000000", acceptTerms: true },
    });
    expect(wrong.json().error).toBe("otp_invalid");

    const ok = await t.app.inject({
      method: "POST",
      url: "/auth/otp/verify",
      payload: { phone: "08031112222", code: OTP, acceptTerms: true },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().isNew).toBe(true);
    expect(ok.json().user.phone).toBe("+2348031112222");

    // A code only works once.
    const again = await t.app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone: "08031112222", code: OTP } });
    expect(again.json().error).toBe("otp_expired");
  });

  it("limits how many codes a number can request", async () => {
    const phone = "08031113333";
    for (let i = 0; i < 3; i++) await t.app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone } });
    const res = await t.app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone } });
    expect(res.statusCode).toBe(429);
  });

  it("needs a token for private routes", async () => {
    expect((await t.app.inject({ method: "GET", url: "/me" })).statusCode).toBe(401);
  });
});

describe("profile and payouts", () => {
  it("sets up profile and bank account", async () => {
    const headers = await t.login("08032220000", false);
    const taken = await t.app.inject({ method: "PATCH", url: "/me", headers, payload: { username: "admin" } });
    expect(taken.json().error).toBe("username_taken");

    const me = await t.app.inject({ method: "PATCH", url: "/me", headers, payload: { name: "Chioma", username: "Chioma.O" } });
    expect(me.json()).toMatchObject({ name: "Chioma", username: "chioma.o", payoutsReady: false });

    const banks = await t.app.inject({ method: "GET", url: "/banks" });
    expect(banks.json().banks.length).toBeGreaterThan(3);

    const resolved = await t.app.inject({
      method: "POST",
      url: "/me/bank-account/resolve",
      headers,
      payload: { bankCode: "999992", accountNumber: "8031234567" },
    });
    expect(resolved.json().accountName).toBe("TEST ACCOUNT HOLDER");

    const bank = await t.app.inject({
      method: "PUT",
      url: "/me/bank-account",
      headers,
      payload: { bankCode: "999992", accountNumber: "8031234567" },
    });
    expect(bank.json()).toMatchObject({ payoutsReady: true, bank: { accountNumberLast4: "4567" } });

    const profile = await t.app.inject({ method: "GET", url: "/users/chioma.o" });
    expect(profile.json()).toMatchObject({ name: "Chioma", payoutsReady: true, bills: [] });
  });

  it("won't let her publish before adding a bank account", async () => {
    const headers = await t.login("08032220001", false);
    await t.app.inject({ method: "PATCH", url: "/me", headers, payload: { name: "Bisi", username: "bisi" } });
    const res = await createBill(headers);
    expect(res.json().error).toBe("payouts_required");
    const draft = await createBill(headers, { draft: true });
    expect(draft.statusCode).toBe(201);
    expect(draft.json().status).toBe("draft");
  });
});

describe("bills and payments", () => {
  it("creates a bill with items and a share message", async () => {
    const headers = await t.login("08040000001");
    const res = await createBill(headers, {
      amountKobo: undefined,
      recipientName: "Tunde",
      items: [
        { name: "Knotless braids", amountKobo: 3_000_000 },
        { name: "Transport", amountKobo: 500_000 },
      ],
    });
    expect(res.statusCode, res.body).toBe(201);
    const bill = res.json();
    expect(bill.totalKobo).toBe(3_500_000);
    expect(bill.items).toHaveLength(2);
    expect(bill.status).toBe("open");
    expect(bill.shareUrl).toBe(`http://localhost:3000/b/${bill.slug}`);
    expect(bill.shareMessage).toContain("Hey baby Tunde");
    expect(bill.shareMessage).toContain("₦35,000");
    expect(bill.events.map((e: { type: string }) => e.type)).toEqual(["created", "published"]);
  });

  it("tracks the first open, but not her own preview", async () => {
    const headers = await t.login("08040000002");
    const { slug, id } = (await createBill(headers)).json();
    await t.app.inject({ method: "GET", url: `/pay/${slug}`, headers });
    let detail = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(detail.openedAt).toBeNull();

    const view = await t.app.inject({ method: "GET", url: `/pay/${slug}` });
    expect(view.json()).toMatchObject({ payable: true, remainingKobo: 2_500_000, sender: { name: "Ada" } });
    expect(view.json()).not.toHaveProperty("recipientPhone");
    await t.app.inject({ method: "GET", url: `/pay/${slug}` });
    detail = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(detail.openedAt).not.toBeNull();
    expect(detail.viewCount).toBe(2);
    expect(detail.events.filter((e: { type: string }) => e.type === "opened")).toHaveLength(1);
  });

  it("takes a part payment, then the rest, and notifies her", async () => {
    const headers = await t.login("08040000003");
    const { slug, id } = (await createBill(headers)).json();

    await pay(slug, 1_000_000);
    let bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill).toMatchObject({ status: "part_paid", paidKobo: 1_000_000 });

    const tooMuch = await t.app.inject({
      method: "POST",
      url: `/pay/${slug}/initialize`,
      payload: { amountKobo: 2_000_000, payerName: "Tunde" },
    });
    expect(tooMuch.json().message).toContain("₦15,000");

    const reference = await pay(slug, 1_500_000);
    bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill).toMatchObject({ status: "paid", paidKobo: 2_500_000 });
    expect(bill.payments.filter((p: { status: string }) => p.status === "success")).toHaveLength(2);

    // Coming back to the receipt page again doesn't count the payment twice.
    const verify = await t.app.inject({ method: "GET", url: `/pay/${slug}/verify?reference=${reference}` });
    expect(verify.json().payment.status).toBe("success");
    bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill.paidKobo).toBe(2_500_000);

    const notes = (await t.app.inject({ method: "GET", url: "/me/notifications", headers })).json();
    expect(notes.items.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining(["bill_paid", "bill_part_paid"]),
    );
    expect(t.sms.sent.some((s) => s.message.includes("fully paid"))).toBe(true);

    const closed = await t.app.inject({ method: "POST", url: `/pay/${slug}/initialize`, payload: { amountKobo: 10_000, payerName: "Kola" } });
    expect(closed.json().error).toBe("not_payable");
  });

  it("enforces full payment when part payment is off", async () => {
    const headers = await t.login("08040000004");
    const { slug } = (await createBill(headers, { allowPartial: false })).json();
    const res = await t.app.inject({ method: "POST", url: `/pay/${slug}/initialize`, payload: { amountKobo: 1_000_000, payerName: "Tunde" } });
    expect(res.json().message).toMatch(/paid in full/);
  });

  it("ignores failed payments", async () => {
    const headers = await t.login("08040000005");
    const { slug, id } = (await createBill(headers)).json();
    await pay(slug, 2_500_000, "failed");
    const bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill).toMatchObject({ status: "open", paidKobo: 0 });
    expect(bill.payments[0].status).toBe("failed");
  });

  it("checks webhook signatures", async () => {
    const headers = await t.login("08040000006");
    const { slug, id } = (await createBill(headers)).json();
    const init = await t.app.inject({ method: "POST", url: `/pay/${slug}/initialize`, payload: { amountKobo: 2_500_000, payerName: "Tunde" } });
    const { reference } = init.json();
    t.payments.complete(reference, "success");
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    const forged = await t.app.inject({
      method: "POST",
      url: "/webhooks/paystack",
      headers: { "content-type": "application/json", "x-paystack-signature": "nope" },
      payload: body,
    });
    expect(forged.statusCode).toBe(401);

    const real = await t.app.inject({
      method: "POST",
      url: "/webhooks/paystack",
      headers: { "content-type": "application/json", "x-paystack-signature": t.payments.sign(body) },
      payload: body,
    });
    expect(real.statusCode).toBe(200);
    const bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill.status).toBe("paid");
  });

  it("lets him decline", async () => {
    const headers = await t.login("08040000007");
    const { slug, id } = (await createBill(headers)).json();
    await t.app.inject({ method: "POST", url: `/pay/${slug}/decline`, payload: { reason: "Not this month" } });
    const bill = (await t.app.inject({ method: "GET", url: `/bills/${id}`, headers })).json();
    expect(bill).toMatchObject({ status: "declined", declineReason: "Not this month" });
  });

  it("lets him block her, which stops new bills to his number", async () => {
    const headers = await t.login("08040000008");
    const { slug } = (await createBill(headers, { recipientPhone: "08055556666" })).json();
    const res = await t.app.inject({ method: "POST", url: `/pay/${slug}/block`, payload: {} });
    expect(res.statusCode).toBe(200);
    const again = await createBill(headers, { recipientPhone: "0805 555 6666" });
    expect(again.statusCode).toBe(403);
  });

  it("edits, duplicates, cancels and deletes", async () => {
    const headers = await t.login("08040000009");
    const { id } = (await createBill(headers)).json();
    const edited = await t.app.inject({ method: "PATCH", url: `/bills/${id}`, headers, payload: { title: "Braids", amountKobo: 3_000_000 } });
    expect(edited.json()).toMatchObject({ title: "Braids", totalKobo: 3_000_000 });

    const dup = await t.app.inject({ method: "POST", url: `/bills/${id}/duplicate`, headers });
    expect(dup.json()).toMatchObject({ title: "Braids", status: "draft" });
    const published = await t.app.inject({ method: "POST", url: `/bills/${dup.json().id}/publish`, headers });
    expect(published.json().status).toBe("open");

    const cancelled = await t.app.inject({ method: "POST", url: `/bills/${id}/cancel`, headers });
    expect(cancelled.json().status).toBe("cancelled");
    const view = await t.app.inject({ method: "GET", url: `/pay/${cancelled.json().slug}` });
    expect(view.json().payable).toBe(false);

    const draft = (await createBill(headers, { draft: true })).json();
    expect((await t.app.inject({ method: "DELETE", url: `/bills/${draft.id}`, headers })).statusCode).toBe(200);

    const other = await t.login("08040000010");
    expect((await t.app.inject({ method: "GET", url: `/bills/${id}`, headers: other })).statusCode).toBe(404);
  });

  it("expires overdue bills", async () => {
    const headers = await t.login("08040000011");
    const { id, slug } = (await createBill(headers, { expiresInDays: 1 })).json();
    await t.ctx.db.update(bills).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(bills.id, id));
    expect(await expireDueBills(t.ctx)).toBeGreaterThanOrEqual(1);
    const view = (await t.app.inject({ method: "GET", url: `/pay/${slug}` })).json();
    expect(view).toMatchObject({ status: "expired", payable: false });
  });

  it("shows public bills on her page and lists her bills with totals", async () => {
    const headers = await t.login("08040000012");
    await createBill(headers, { visibility: "public", title: "Birthday", category: "birthday" });
    await createBill(headers, { title: "Private one" });
    const me = (await t.app.inject({ method: "GET", url: "/me", headers })).json();
    const page = (await t.app.inject({ method: "GET", url: `/users/${me.username}` })).json();
    expect(page.bills.map((b: { title: string }) => b.title)).toEqual(["Birthday"]);

    const list = (await t.app.inject({ method: "GET", url: "/bills?status=active", headers })).json();
    expect(list.bills).toHaveLength(2);
    expect(list.stats).toMatchObject({ activeCount: 2, waitingKobo: 5_000_000 });
  });
});

describe("media, reports and admin", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("uploads a photo and attaches it to a bill", async () => {
    const headers = await t.login("08050000001");
    const up = await t.app.inject({ method: "POST", url: "/media", headers, payload: { dataUrl: png } });
    expect(up.statusCode).toBe(201);
    const img = await t.app.inject({ method: "GET", url: up.json().url });
    expect(img.headers["content-type"]).toBe("image/png");
    const bill = (await createBill(headers, { photoMediaIds: [up.json().id] })).json();
    expect(bill.photoUrls).toEqual([up.json().url]);

    const stranger = await t.login("08050000002");
    const steal = await createBill(stranger, { photoMediaIds: [up.json().id] });
    expect(steal.statusCode).toBe(400);
  });

  it("takes reports and lets an admin suspend the sender", async () => {
    const headers = await t.login("08050000003");
    const { slug } = (await createBill(headers)).json();
    await t.app.inject({ method: "POST", url: `/pay/${slug}/report`, payload: { reason: "scam", details: "Fake" } });

    const user = await t.login("08050000004");
    expect((await t.app.inject({ method: "GET", url: "/admin/stats", headers: user })).statusCode).toBe(403);

    const admin = await t.login("08000000001");
    const stats = (await t.app.inject({ method: "GET", url: "/admin/stats", headers: admin })).json();
    expect(stats.reports.open).toBe(1);
    const reports = (await t.app.inject({ method: "GET", url: "/admin/reports", headers: admin })).json().reports;
    expect(reports[0]).toMatchObject({ reason: "scam", billSlug: slug });

    await t.app.inject({ method: "POST", url: `/admin/users/${reports[0].reportedUserId}/suspend`, headers: admin });
    expect((await t.app.inject({ method: "GET", url: "/me", headers })).statusCode).toBe(403);
    expect((await t.app.inject({ method: "GET", url: `/pay/${slug}` })).json().payable).toBe(false);
  });

  it("exports and deletes an account", async () => {
    const headers = await t.login("08050000005");
    const { slug } = (await createBill(headers)).json();
    const exp = (await t.app.inject({ method: "GET", url: "/me/export", headers })).json();
    expect(exp.bills).toHaveLength(1);
    expect(exp.profile).not.toHaveProperty("subaccountCode");

    expect((await t.app.inject({ method: "DELETE", url: "/me", headers })).statusCode).toBe(200);
    expect((await t.app.inject({ method: "GET", url: "/me", headers })).statusCode).toBe(401);
    expect((await t.app.inject({ method: "GET", url: `/pay/${slug}` })).statusCode).toBe(404);
    // The same number can sign up fresh afterwards.
    const res = await t.app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone: "08050000005" } });
    expect(res.json().isNewUser).toBe(true);
  });
});
