import { describe, test, expect } from "vitest";
import { routeCheckout, paypalAmount, type CheckoutPlanItem } from "@/lib/checkout/router";
import type { ProviderCapabilities } from "@/lib/core/provider";

const item = (over: Partial<CheckoutPlanItem> = {}): CheckoutPlanItem => ({
  provider: "ebay",
  currency: "INR",
  priceMinor: 199900,
  quantity: 1,
  canonicalUrl: "https://www.ebay.in/itm/x",
  ...over,
});

const ebayCaps: ProviderCapabilities = {
  search: true,
  productDetails: true,
  checkout: ["EXTERNAL_CHECKOUT"],
  supportedCurrencies: ["INR"],
  markets: ["IN"],
};

const paypalCaps: ProviderCapabilities = {
  search: false,
  productDetails: false,
  checkout: ["PAYPILOT_PAYPAL"],
  supportedCurrencies: ["USD"],
  markets: ["US"],
};

const paypalOn = { configured: true, supportedCurrencies: ["USD"], environment: "sandbox" };
const paypalOff = { configured: false, supportedCurrencies: ["USD"], environment: "sandbox" };

describe("routeCheckout", () => {
  test("unconfigured PayPal routes everything to EXTERNAL_CHECKOUT with honest reason", () => {
    const intents = routeCheckout([item(), item({ provider: "flipkart" })], { ebay: ebayCaps }, paypalOff);
    expect(intents).toHaveLength(2);
    expect(intents.every((i) => i.method === "EXTERNAL_CHECKOUT")).toBe(true);
    expect(intents.find((i) => i.provider === "ebay")!.reason).toContain("official website");
  });

  test("providers never merge — one intent per merchant, subtotals per group", () => {
    const intents = routeCheckout(
      [item({ quantity: 2 }), item({ provider: "flipkart", priceMinor: 50000, quantity: 3 })],
      { ebay: ebayCaps, flipkart: { ...ebayCaps, markets: ["IN"] } },
      paypalOff
    );
    expect(intents.map((i) => i.provider)).toEqual(["ebay", "flipkart"]);
    expect(intents[0].subtotalMinor).toBe(399800);
    expect(intents[1].subtotalMinor).toBe(150000);
  });

  test("PAYPILOT_PAYPAL only when provider declares it AND currency supported", () => {
    const caps = { paypaletail: paypalCaps };
    const usd = routeCheckout([item({ provider: "paypaletail", currency: "USD", priceMinor: 1999 })], caps, paypalOn);
    expect(usd[0].method).toBe("PAYPILOT_PAYPAL");
    const inr = routeCheckout([item({ provider: "paypaletail", currency: "INR" })], caps, paypalOn);
    expect(inr[0].method).toBe("EXTERNAL_CHECKOUT");
    expect(inr[0].reason).toContain("INR");
  });

  test("declared PAYPILOT_PAYPAL but PayPal unconfigured → external", () => {
    const intents = routeCheckout([item({ provider: "paypaletail", currency: "USD" })], { paypaletail: paypalCaps }, paypalOff);
    expect(intents[0].method).toBe("EXTERNAL_CHECKOUT");
    expect(intents[0].reason).toContain("not configured");
  });

  test("unknown provider capabilities default to external checkout", () => {
    const intents = routeCheckout([item({ provider: "mystery" })], {}, paypalOn);
    expect(intents[0].method).toBe("EXTERNAL_CHECKOUT");
  });
});

describe("paypalAmount", () => {
  test("formats minor units as two-decimal string", () => {
    expect(paypalAmount(199900, "INR")).toBe("1999.00");
    expect(paypalAmount(5, "USD")).toBe("0.05");
    expect(paypalAmount(0, "USD")).toBe("0.00");
  });

  test("rejects unsupported currency", () => {
    expect(() => paypalAmount(100, "JPY")).toThrow(/Unsupported currency/);
  });
});
