/**
 * Normalises a Nigerian mobile number to E.164 (+234XXXXXXXXXX).
 * Accepts 08012345678, 8012345678, 2348012345678 and +234 801 234 5678.
 * Returns null when the number is not a valid Nigerian mobile number.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string;
  if (digits.startsWith("234") && digits.length === 13) local = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 11) local = digits.slice(1);
  else if (digits.length === 10) local = digits;
  else return null;
  // Nigerian mobile numbers start with 7, 8 or 9 after the leading zero.
  if (!/^[789][01]\d{8}$/.test(local)) return null;
  return `+234${local}`;
}

/** Shows +2348012345678 as 0801 234 5678. */
export function formatNigerianPhone(e164: string): string {
  const local = "0" + e164.replace(/^\+234/, "");
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Hides the middle of a number for public display: 0801 *** 5678. */
export function maskPhone(e164: string): string {
  const formatted = formatNigerianPhone(e164);
  return formatted.slice(0, 4) + " *** " + formatted.slice(-4);
}
