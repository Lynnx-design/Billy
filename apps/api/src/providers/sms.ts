import type { FastifyBaseLogger } from "fastify";

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

/** Termii (termii.com), a Nigerian SMS provider with good delivery to local networks. */
export class TermiiSmsProvider implements SmsProvider {
  constructor(
    private apiKey: string,
    private senderId: string,
    private log: FastifyBaseLogger,
  ) {}

  async send(to: string, message: string) {
    const res = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        to: to.replace(/^\+/, ""),
        from: this.senderId,
        sms: message,
        type: "plain",
        // The "dnd" route reaches numbers on Do-Not-Disturb, which OTPs need.
        channel: "dnd",
      }),
    });
    if (!res.ok) {
      this.log.error({ status: res.status, body: await res.text().catch(() => "") }, "Termii SMS failed");
      throw new Error("SMS failed");
    }
  }
}

/** Prints messages to the log instead of sending them. Used in development and tests. */
export class ConsoleSmsProvider implements SmsProvider {
  sent: { to: string; message: string }[] = [];

  constructor(private log?: FastifyBaseLogger) {}

  async send(to: string, message: string) {
    this.sent.push({ to, message });
    this.log?.info({ to, message }, "SMS (not sent, no TERMII_API_KEY)");
  }
}
