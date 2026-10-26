import { describe, expect, it } from "vitest";
import {
  buildShareMessage,
  createBillSchema,
  estimatePaystackFeeKobo,
  formatNaira,
  maskPhone,
  normalizeNigerianPhone,
} from "./index";

describe("normalizeNigerianPhone", () => {
  it.each([
    ["08031234567", "+2348031234567"],
    ["8031234567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["0701-234-5678", "+2347012345678"],
    ["09012345678", "+2349012345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(["0803123456", "06031234567", "+447911123456", "hello"])("rejects %s", (input) => {
    expect(normalizeNigerianPhone(input)).toBeNull();
  });

  it("masks numbers", () => {
    expect(maskPhone("+2348031234567")).toBe("0803 *** 4567");
  });
});

describe("money", () => {
  it("formats naira", () => {
    expect(formatNaira(1_250_000)).toBe("₦12,500");
    expect(formatNaira(1_250_050)).toBe("₦12,500.50");
  });

  it("estimates Paystack fees", () => {
    expect(estimatePaystackFeeKobo(200_000)).toBe(3_000); // ₦2,000 -> 1.5%, no flat fee
    expect(estimatePaystackFeeKobo(1_000_000)).toBe(25_000); // ₦10,000 -> ₦150 + ₦100
    expect(estimatePaystackFeeKobo(100_000_000)).toBe(200_000); // capped at ₦2,000
  });
});

describe("createBillSchema", () => {
  const base = { title: "Hair", category: "hair", relationship: "partner" };

  it("needs an amount or items", () => {
    expect(createBillSchema.safeParse(base).success).toBe(false);
    expect(createBillSchema.safeParse({ ...base, amountKobo: 1_000_000 }).success).toBe(true);
    expect(
      createBillSchema.safeParse({ ...base, items: [{ name: "Braids", amountKobo: 1_500_000 }] }).success,
    ).toBe(true);
  });

  it("rejects amounts under ₦100", () => {
    expect(createBillSchema.safeParse({ ...base, amountKobo: 5_000 }).success).toBe(false);
  });
});

describe("buildShareMessage", () => {
  it("combines template and relationship", () => {
    const msg = buildShareMessage({
      category: "hair",
      relationship: "partner",
      recipientName: "Tunde",
      title: "Hair appointment",
      amount: "₦25,000",
      link: "https://billy.ng/b/abc",
    });
    expect(msg).toContain("Hey baby Tunde");
    expect(msg).toContain("₦25,000 for my hair appointment");
    expect(msg).toContain("https://billy.ng/b/abc");
  });
});
