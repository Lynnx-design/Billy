import crypto from "node:crypto";

// No 0/O, 1/l/I so links are easy to read out loud or type.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomId(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newBillSlug = () => randomId(8);
export const newPaymentReference = () => `BLY_${Date.now().toString(36)}_${randomId(10)}`;

export function newOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(phone: string, code: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}
