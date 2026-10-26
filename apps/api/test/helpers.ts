import pg from "pg";
import { buildApp } from "../src/app";
import { loadConfig } from "../src/config";
import { runMigrations } from "../src/db/migrate";
import { MockPaymentProvider } from "../src/providers/payments";
import { ConsoleSmsProvider } from "../src/providers/sms";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://billy:billy@localhost:5432/billy_test";
export const OTP = "123456";

export async function resetDb() {
  const client = new pg.Client({ connectionString: TEST_DB });
  await client.connect();
  await client.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await client.end();
  await runMigrations(TEST_DB);
}

export async function setup() {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DB,
    JWT_SECRET: "test-secret",
    WEB_URL: "http://localhost:3000",
    TEST_OTP_CODE: OTP,
    ADMIN_PHONES: "08000000001",
  } as NodeJS.ProcessEnv);
  const payments = new MockPaymentProvider(config.webUrl);
  const sms = new ConsoleSmsProvider();
  const { app, ctx } = await buildApp({ config, payments, sms, logger: false, disableRateLimit: true });
  await app.ready();

  async function login(phone: string, profile = true) {
    await app.inject({ method: "POST", url: "/auth/otp/request", payload: { phone } });
    const res = await app.inject({ method: "POST", url: "/auth/otp/verify", payload: { phone, code: OTP, acceptTerms: true } });
    const { token } = res.json();
    const headers = { authorization: `Bearer ${token}` };
    if (profile) {
      const username = "u" + phone.replace(/\D/g, "").slice(-8);
      await app.inject({ method: "PATCH", url: "/me", headers, payload: { name: "Ada", username } });
      await app.inject({ method: "PUT", url: "/me/bank-account", headers, payload: { bankCode: "058", accountNumber: "0123456789" } });
    }
    return headers;
  }

  return { app, ctx, payments, sms, login };
}
