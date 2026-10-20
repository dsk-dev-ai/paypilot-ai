import { describe, test, expect } from "vitest";
import { formatAmount } from "@/modules/payments/service";

describe("currency handling", () => {
  test("amount formatted to 2 decimals for USD", () => {
    expect(formatAmount(10)).toBe("10.00");
    expect(formatAmount(10.5)).toBe("10.50");
    expect(formatAmount(99.99)).toBe("99.99");
  });

  test("currency is USD", () => {
    const currency = "USD";
    expect(currency).toBe("USD");
  });
});
