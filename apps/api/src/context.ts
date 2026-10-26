import type { Config } from "./config";
import type { Db } from "./db";
import type { PaymentProvider } from "./providers/payments";
import type { SmsProvider } from "./providers/sms";

/** Shared services handed to every route module. */
export interface AppContext {
  config: Config;
  db: Db;
  payments: PaymentProvider;
  sms: SmsProvider;
}
