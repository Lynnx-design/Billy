// All money is stored and sent as whole kobo (₦1 = 100 kobo) to avoid float errors.

export const KOBO_PER_NAIRA = 100;

/** Smallest amount anyone can pay in one go: ₦100. */
export const MIN_PAYMENT_KOBO = 100 * KOBO_PER_NAIRA;

/** Largest single bill: ₦10,000,000. */
export const MAX_BILL_KOBO = 10_000_000 * KOBO_PER_NAIRA;

export function nairaToKobo(naira: number): number {
  return Math.round(naira * KOBO_PER_NAIRA);
}

export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

/** Formats kobo as "₦12,500" (or "₦12,500.50" when there are kobo). */
export function formatNaira(kobo: number): string {
  const naira = kobo / KOBO_PER_NAIRA;
  const hasKobo = kobo % KOBO_PER_NAIRA !== 0;
  return (
    "₦" +
    naira.toLocaleString("en-NG", {
      minimumFractionDigits: hasKobo ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Paystack's local transaction fee: 1.5% + ₦100, with the ₦100 waived under ₦2,500
 * and the total capped at ₦2,000.
 */
export function estimatePaystackFeeKobo(amountKobo: number): number {
  const percent = Math.round(amountKobo * 0.015);
  const flat = amountKobo >= 2_500 * KOBO_PER_NAIRA ? 100 * KOBO_PER_NAIRA : 0;
  return Math.min(percent + flat, 2_000 * KOBO_PER_NAIRA);
}

/** What the sender should expect to land in her bank after Paystack and Billy fees. */
export function estimatePayoutKobo(amountKobo: number, billyFeePercent = 0): number {
  const billyFee = Math.round((amountKobo * billyFeePercent) / 100);
  return Math.max(0, amountKobo - estimatePaystackFeeKobo(amountKobo) - billyFee);
}
