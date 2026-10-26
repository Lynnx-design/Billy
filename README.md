# Billy

Billy lets a woman create a bill, share one link on WhatsApp, and get paid by **bank transfer, debit card or USSD**. The person paying doesn't need an account or an app. Money settles straight to her bank account through Paystack, so Billy never holds funds.

This is the first web version. The API is separate so the Android, iOS and WhatsApp versions can reuse it later.

## What's in this version

- **Accounts:** phone number + SMS code sign-up, profile with photo, a personal page (`/ada`), payout bank account checked by account-name lookup.
- **Bills:** 26 ready-made templates (hair, upkeep, rent, Valentine's…), 8 relationship tones for the WhatsApp message, single amount or item list, notes, up to 4 photos, part payments on/off, private or on her page, expiry dates, drafts, edit, duplicate ("send again"), cancel.
- **Sharing:** WhatsApp (pre-written message), SMS, Instagram, native share, copy link, and a pink preview card when the link is pasted in chats.
- **Paying (him):** no account needed; pay all or part; transfer, card or USSD through Paystack; receipt page; decline with a reason; "stop bills from her"; report.
- **Tracking:** live status (waiting, part paid, paid, declined, expired), opened/paid timeline, payments list, dashboard totals, in-app alerts plus SMS when money arrives.
- **Safety and admin:** rate limits, daily bill cap, blocks by phone number, reports, admin page (stats, users, bills, payments, reports, suspend), data export and account deletion.

The full feature split (now vs later) is in the project's "Billy feature list" doc.

## Layout

```
apps/api       Fastify + TypeScript API, Drizzle ORM, PostgreSQL
apps/web       Next.js 15 web app (mobile-first, Tailwind, pink theme)
packages/shared  Types, validation, templates and money helpers used by both
```

## Run it locally

Needs Node 22, pnpm 10 and PostgreSQL 16.

```bash
pnpm install
createdb billy                      # or use any Postgres URL
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev                            # API on :4000, web on :3000
```

Without a `PAYSTACK_SECRET_KEY`, the API uses a **test checkout** (`/test-checkout`) where you choose "successful" or "failed", so you can try the whole flow with no real money. Without a `TERMII_API_KEY`, login codes are printed in the API log instead of sent by SMS.

To make yourself an admin, put your number in `ADMIN_PHONES` and log in again.

## Tests

```bash
createdb billy_test
pnpm test        # shared + API integration tests (real Postgres)
pnpm typecheck
```

## Going live

1. **Paystack:** open a business account at paystack.com, complete compliance, and set `PAYSTACK_SECRET_KEY`. In the Paystack dashboard set the webhook URL to `https://<api-domain>/webhooks/paystack`.
2. **Termii:** create an account, register the `Billy` sender ID, and set `TERMII_API_KEY`.
3. **Hosting:** the web app deploys to Vercel (root `apps/web`); the API and Postgres to Render or Railway (start command `pnpm --filter @billy/api start`, which runs migrations first). Set `NODE_ENV=production`, a long random `JWT_SECRET`, `WEB_URL`, `CORS_ORIGINS`, and on the web app `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WEB_URL`.
4. Have a lawyer review the draft Terms and Privacy pages.

## Fees

Paystack charges 1.5% + ₦100 per local payment (₦100 waived under ₦2,500, capped at ₦2,000). The fee comes out of what she receives, so he pays exactly the bill amount. `BILLY_FEE_PERCENT` adds an optional Billy cut via Paystack split payments (default 0).
