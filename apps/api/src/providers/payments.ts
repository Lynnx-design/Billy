import crypto from "node:crypto";
import type { BankDto } from "@billy/shared";
import { badRequest, HttpError } from "../errors";

export interface InitializeArgs {
  reference: string;
  amountKobo: number;
  email: string;
  subaccountCode: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountKobo: number;
  channel: string | null;
  paidAt: Date | null;
}

/**
 * Everything Billy needs from a payment gateway. Paystack is the default; Flutterwave can
 * be added later as another implementation without touching the routes.
 */
export interface PaymentProvider {
  name: string;
  listBanks(): Promise<BankDto[]>;
  resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string }>;
  createSubaccount(args: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge: number;
  }): Promise<{ subaccountCode: string }>;
  updateSubaccount(code: string, args: { bankCode: string; accountNumber: string; businessName: string }): Promise<void>;
  initialize(args: InitializeArgs): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<VerifyResult>;
  /** True when a webhook body really came from the provider. */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}

// Card, bank transfer and USSD: the three payment options from the plan.
export const PAYMENT_CHANNELS = ["bank_transfer", "card", "ussd"];

export class PaystackProvider implements PaymentProvider {
  name = "paystack";
  private banksCache: { at: number; banks: BankDto[] } | null = null;

  constructor(
    private secretKey: string,
    private baseUrl = "https://api.paystack.co",
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !json.status) {
      if (res.status >= 400 && res.status < 500) {
        throw badRequest(json.message ?? "Payment provider rejected the request", "provider_error");
      }
      throw new HttpError(502, "provider_unavailable", "Payments are unavailable right now, please try again");
    }
    return json.data as T;
  }

  async listBanks(): Promise<BankDto[]> {
    if (this.banksCache && Date.now() - this.banksCache.at < 24 * 3600_000) return this.banksCache.banks;
    const data = await this.call<{ name: string; code: string; active: boolean }[]>(
      "GET",
      "/bank?country=nigeria&perPage=200",
    );
    const banks = data.filter((b) => b.active).map((b) => ({ code: b.code, name: b.name }));
    this.banksCache = { at: Date.now(), banks };
    return banks;
  }

  async resolveAccount(accountNumber: string, bankCode: string) {
    const data = await this.call<{ account_name: string }>(
      "GET",
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    return { accountName: data.account_name };
  }

  async createSubaccount(args: { businessName: string; bankCode: string; accountNumber: string; percentageCharge: number }) {
    const data = await this.call<{ subaccount_code: string }>("POST", "/subaccount", {
      business_name: args.businessName,
      settlement_bank: args.bankCode,
      account_number: args.accountNumber,
      percentage_charge: args.percentageCharge,
    });
    return { subaccountCode: data.subaccount_code };
  }

  async updateSubaccount(code: string, args: { bankCode: string; accountNumber: string; businessName: string }) {
    await this.call("PUT", `/subaccount/${encodeURIComponent(code)}`, {
      business_name: args.businessName,
      settlement_bank: args.bankCode,
      account_number: args.accountNumber,
    });
  }

  async initialize(args: InitializeArgs) {
    const data = await this.call<{ authorization_url: string }>("POST", "/transaction/initialize", {
      email: args.email,
      amount: args.amountKobo,
      reference: args.reference,
      subaccount: args.subaccountCode,
      // She pays the Paystack fee out of what she receives, so he pays exactly the bill amount.
      bearer: "subaccount",
      channels: PAYMENT_CHANNELS,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const data = await this.call<{ status: string; amount: number; channel: string; paid_at: string | null }>(
      "GET",
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    const status = data.status === "success" ? "success" : ["failed", "abandoned", "reversed"].includes(data.status) ? "failed" : "pending";
    return {
      status,
      amountKobo: data.amount,
      channel: data.channel ?? null,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined) {
    if (!signature) return false;
    const expected = crypto.createHmac("sha512", this.secretKey).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

/**
 * Test checkout used when no Paystack key is set. No real money moves: the web app shows a
 * page where you choose "pay" or "fail", and the API records the outcome as if Paystack had.
 */
export class MockPaymentProvider implements PaymentProvider {
  name = "mock";
  /** reference -> outcome chosen on the test checkout page */
  private outcomes = new Map<string, { status: "success" | "failed"; amountKobo: number; channel: string }>();
  private amounts = new Map<string, number>();

  constructor(
    private webUrl: string,
    private secret = "mock-webhook-secret",
  ) {}

  async listBanks(): Promise<BankDto[]> {
    return [
      { code: "044", name: "Access Bank" },
      { code: "058", name: "Guaranty Trust Bank" },
      { code: "011", name: "First Bank of Nigeria" },
      { code: "033", name: "United Bank For Africa" },
      { code: "057", name: "Zenith Bank" },
      { code: "50211", name: "Kuda Bank" },
      { code: "50515", name: "Moniepoint MFB" },
      { code: "999992", name: "OPay Digital Services Limited (OPay)" },
      { code: "999991", name: "PalmPay" },
    ];
  }

  async resolveAccount(accountNumber: string, bankCode: string) {
    if (accountNumber === "0000000000") throw badRequest("We couldn't find that account. Check the number and bank.");
    const bank = (await this.listBanks()).find((b) => b.code === bankCode);
    if (!bank) throw badRequest("Unknown bank");
    return { accountName: "TEST ACCOUNT HOLDER" };
  }

  async createSubaccount() {
    return { subaccountCode: "ACCT_mock" + crypto.randomBytes(5).toString("hex") };
  }

  async updateSubaccount() {}

  async initialize(args: InitializeArgs) {
    this.amounts.set(args.reference, args.amountKobo);
    const url = new URL(`${this.webUrl}/test-checkout`);
    url.searchParams.set("reference", args.reference);
    url.searchParams.set("amount", String(args.amountKobo));
    url.searchParams.set("callback", args.callbackUrl);
    return { authorizationUrl: url.toString() };
  }

  /** Called by the test checkout page (dev only). */
  complete(reference: string, status: "success" | "failed", channel = "bank_transfer") {
    const amountKobo = this.amounts.get(reference);
    if (amountKobo === undefined) return false;
    this.outcomes.set(reference, { status, amountKobo, channel });
    return true;
  }

  async verify(reference: string): Promise<VerifyResult> {
    const outcome = this.outcomes.get(reference);
    if (!outcome) return { status: "pending", amountKobo: this.amounts.get(reference) ?? 0, channel: null, paidAt: null };
    return {
      status: outcome.status,
      amountKobo: outcome.amountKobo,
      channel: outcome.channel,
      paidAt: outcome.status === "success" ? new Date() : null,
    };
  }

  sign(rawBody: string) {
    return crypto.createHmac("sha512", this.secret).update(rawBody).digest("hex");
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined) {
    return !!signature && signature === this.sign(rawBody);
  }
}
