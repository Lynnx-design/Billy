import { normalizeNigerianPhone } from "@billy/shared";

export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  webUrl: string;
  corsOrigins: string[];
  paystackSecretKey: string | null;
  billyFeePercent: number;
  termiiApiKey: string | null;
  termiiSenderId: string;
  adminPhones: string[];
  /** Fixed OTP for automated tests and the demo deploy. Never set in production. */
  testOtpCode: string | null;
  isProduction: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // DEMO_MODE is the test deploy: fixed login code and the test checkout, no real money or SMS.
  const isProduction = env.NODE_ENV === "production" && env.DEMO_MODE !== "true";
  const jwtSecret = env.JWT_SECRET ?? (isProduction ? "" : "dev-secret-not-for-production");
  if (!jwtSecret || (isProduction && jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  }
  // RENDER_EXTERNAL_URL is set by Render, so the one-click deploy needs no URL settings.
  const webUrl = (env.WEB_URL ?? env.RENDER_EXTERNAL_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    // API_PORT lets the API share a host with the web app, which takes PORT.
    port: Number(env.API_PORT ?? env.PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? "postgres://billy:billy@localhost:5432/billy",
    jwtSecret,
    webUrl,
    corsOrigins: (env.CORS_ORIGINS ?? webUrl).split(",").map((o) => o.trim()).filter(Boolean),
    paystackSecretKey: env.PAYSTACK_SECRET_KEY || null,
    billyFeePercent: Number(env.BILLY_FEE_PERCENT ?? 0),
    termiiApiKey: env.TERMII_API_KEY || null,
    termiiSenderId: env.TERMII_SENDER_ID || "Billy",
    adminPhones: (env.ADMIN_PHONES ?? "")
      .split(",")
      .map((p) => normalizeNigerianPhone(p))
      .filter((p): p is string => !!p),
    testOtpCode: isProduction ? null : env.TEST_OTP_CODE || null,
    isProduction,
  };
}
