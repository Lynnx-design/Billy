import { z } from "zod";
import { MAX_BILL_KOBO, MIN_PAYMENT_KOBO } from "./money";
import { normalizeNigerianPhone } from "./phone";
import { BILL_TEMPLATES, RELATIONSHIPS } from "./templates";

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const phone = normalizeNigerianPhone(v);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Nigerian phone number" });
      return z.NEVER;
    }
    return phone;
  });

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  acceptTerms: z.boolean().optional(),
});

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.]{1,22}[a-z0-9])?$/;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, "Use 3 to 24 letters, numbers, dots or underscores")
    .optional(),
  bio: z.string().trim().max(160).optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
});

export const bankAccountSchema = z.object({
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
});

export const billItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amountKobo: z.number().int().positive().max(MAX_BILL_KOBO),
});

const categoryIds = BILL_TEMPLATES.map((t) => t.id) as [string, ...string[]];
const relationshipIds = RELATIONSHIPS.map((r) => r.id) as [string, ...string[]];

const billFields = {
  title: z.string().trim().min(2).max(80),
  category: z.enum(categoryIds),
  relationship: z.enum(relationshipIds),
  note: z.string().trim().max(500).optional().nullable(),
  recipientName: z.string().trim().max(60).optional().nullable(),
  recipientPhone: phoneSchema.optional().nullable(),
  /** Used when there are no items. Ignored when items are given. */
  amountKobo: z.number().int().min(MIN_PAYMENT_KOBO).max(MAX_BILL_KOBO).optional(),
  items: z.array(billItemSchema).max(20).optional(),
  photoMediaIds: z.array(z.string().uuid()).max(4).optional(),
  allowPartial: z.boolean().default(true),
  visibility: z.enum(["private", "public"]).default("private"),
  /** Days until the bill expires, 1 to 90. */
  expiresInDays: z.number().int().min(1).max(90).default(14),
  /** Save as a draft instead of making the link live. */
  draft: z.boolean().default(false),
};

function hasAmount(v: { amountKobo?: number; items?: unknown[] }) {
  return (v.items && v.items.length > 0) || typeof v.amountKobo === "number";
}

export const createBillSchema = z
  .object(billFields)
  .refine(hasAmount, { message: "Add an amount or at least one item", path: ["amountKobo"] });

export const updateBillSchema = z.object(billFields).partial();

export const initializePaymentSchema = z.object({
  amountKobo: z.number().int().positive(),
  payerName: z.string().trim().min(2).max(60),
  payerEmail: z.string().trim().email().max(120).optional().or(z.literal("")),
  payerPhone: phoneSchema.optional().or(z.literal("")),
  message: z.string().trim().max(200).optional(),
});

export const declineSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const blockSchema = z.object({
  phone: phoneSchema,
});

export const reportSchema = z.object({
  reason: z.enum(["scam", "harassment", "spam", "impersonation", "other"]),
  details: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(120).optional(),
});

export type CreateBillInput = z.input<typeof createBillSchema>;
export type InitializePaymentInput = z.input<typeof initializePaymentSchema>;
