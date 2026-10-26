import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const billStatus = pgEnum("bill_status", [
  "draft",
  "open",
  "part_paid",
  "paid",
  "declined",
  "expired",
  "cancelled",
]);
export const billVisibility = pgEnum("bill_visibility", ["private", "public"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "success", "failed"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved"]);

export const users = pgTable("users", {
  id: id(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  username: text("username").unique(),
  bio: text("bio"),
  avatarMediaId: uuid("avatar_media_id"),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  bankCode: text("bank_code"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  subaccountCode: text("subaccount_code"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("otp_codes_phone_idx").on(t.phone, t.createdAt)],
);

export const media = pgTable("media", {
  id: id(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const bills = pgTable(
  "bills",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    relationship: text("relationship").notNull(),
    note: text("note"),
    recipientName: text("recipient_name"),
    recipientPhone: text("recipient_phone"),
    totalKobo: integer("total_kobo").notNull(),
    paidKobo: integer("paid_kobo").notNull().default(0),
    allowPartial: boolean("allow_partial").notNull().default(true),
    visibility: billVisibility("visibility").notNull().default("private"),
    status: billStatus("status").notNull().default("draft"),
    photoMediaIds: uuid("photo_media_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    declineReason: text("decline_reason"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bills_sender_idx").on(t.senderId, t.createdAt),
    index("bills_status_expiry_idx").on(t.status, t.expiresAt),
  ],
);

export const billItems = pgTable("bill_items", {
  id: id(),
  billId: uuid("bill_id")
    .notNull()
    .references(() => bills.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountKobo: integer("amount_kobo").notNull(),
  position: integer("position").notNull().default(0),
});

export const billEvents = pgTable(
  "bill_events",
  {
    id: id(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("bill_events_bill_idx").on(t.billId, t.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(),
    provider: text("provider").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    channel: text("channel"),
    payerName: text("payer_name").notNull(),
    payerEmail: text("payer_email"),
    payerPhone: text("payer_phone"),
    message: text("message"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_bill_idx").on(t.billId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** A man who asked not to receive bills from a sender, identified by his phone number. */
export const blocks = pgTable(
  "blocks",
  {
    id: id(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientPhone: text("recipient_phone").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("blocks_sender_phone_idx").on(t.senderId, t.recipientPhone)],
);

export const reports = pgTable("reports", {
  id: id(),
  billId: uuid("bill_id").references(() => bills.id, { onDelete: "set null" }),
  reportedUserId: uuid("reported_user_id").references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  contact: text("contact"),
  status: reportStatus("status").notNull().default("open"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type BillItem = typeof billItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
