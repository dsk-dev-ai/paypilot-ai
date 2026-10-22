import { describe, test, expect } from "vitest";
import {
  money,
  parseMoney,
  toDecimalString,
  addMoney,
  subMoney,
  mulInt,
  cmpMoney,
  sumMoney,
  formatMoney,
} from "@/lib/core/money";

describe("money (minor units)", () => {
  test("parses decimal strings into minor units", () => {
    expect(parseMoney("10.99", "USD")).toEqual({ amountMinor: 1099, currency: "USD" });
    expect(parseMoney("0.05", "INR")).toEqual({ amountMinor: 5, currency: "INR" });
    expect(parseMoney("1200", "INR")).toEqual({ amountMinor: 120000, currency: "INR" });
    expect(parseMoney("-3.50", "USD")).toEqual({ amountMinor: -350, currency: "USD" });
  });

  test("rejects invalid amounts", () => {
    expect(() => parseMoney("abc", "USD")).toThrow();
    expect(() => parseMoney("10.999", "USD")).toThrow(/Too many decimal places/);
    expect(() => parseMoney("", "USD")).toThrow();
  });

  test("round-trips through decimal strings", () => {
    expect(toDecimalString(parseMoney("99.05", "USD"))).toBe("99.05");
    expect(toDecimalString(money("INR", 7))).toBe("0.07");
    expect(toDecimalString(money("USD", -12345))).toBe("-123.45");
  });

  test("adds and subtracts exactly (no float drift)", () => {
    const a = parseMoney("0.10", "USD");
    const b = parseMoney("0.20", "USD");
    expect(addMoney(a, b).amountMinor).toBe(30);
    // classic float trap: 0.1 + 0.2 !== 0.3 in floating point
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(subMoney(parseMoney("1.00", "USD"), parseMoney("0.99", "USD")).amountMinor).toBe(1);
  });

  test("summing many cents stays exact", () => {
    const items = Array.from({ length: 100 }, () => parseMoney("0.03", "USD"));
    expect(sumMoney(items).amountMinor).toBe(300);
    expect(toDecimalString(sumMoney(items))).toBe("3.00");
  });

  test("rejects currency mismatches", () => {
    expect(() => addMoney(money("USD", 100), money("INR", 100))).toThrow(/Currency mismatch/);
    expect(() => cmpMoney(money("USD", 1), money("EUR", 1))).toThrow(/Currency mismatch/);
  });

  test("multiplies by quantity", () => {
    expect(mulInt(parseMoney("19.99", "USD"), 3).amountMinor).toBe(5997);
    expect(() => mulInt(money("USD", 100), -1)).toThrow();
    expect(() => mulInt(money("USD", 100), 1.5)).toThrow();
  });

  test("compares correctly", () => {
    expect(cmpMoney(money("USD", 100), money("USD", 200))).toBe(-1);
    expect(cmpMoney(money("USD", 200), money("USD", 200))).toBe(0);
    expect(cmpMoney(money("USD", 300), money("USD", 200))).toBe(1);
  });

  test("formatMoney produces a currency string", () => {
    const s = formatMoney(parseMoney("1234.56", "INR"), "en-IN");
    expect(s).toContain("1,234.56");
    expect(s.length).toBeGreaterThan(3);
  });
});
