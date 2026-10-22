import { describe, test, expect } from "vitest";
import { evaluateMandate, type MandatePolicy, type MandateItem } from "@/lib/mandate/engine";
import type { ProductListing } from "@/lib/core/listing";

const policy: MandatePolicy = {
  budgetMinor: 100000,
  currency: "INR",
  minUnspentMinor: 5000,
  preferredBrands: ["Sony"],
  excludedBrands: ["CounterfeitCorp"],
  requiredAttributes: {},
  maxQuantityPerItem: 2,
  maxTotalItems: 5,
  allowedProviders: [],
  excludedProviders: [],
  allowedDestinations: ["IN"],
  maxListingAgeMinutes: 1440,
};

function listing(overrides: Partial<ProductListing> = {}): ProductListing {
  return {
    id: "ebay:1",
    provider: "ebay",
    externalId: "1",
    title: "Sony WH-1000XM5",
    canonicalUrl: "https://www.ebay.in/itm/1",
    price: { amountMinor: 2500000, currency: "INR" },
    availability: "IN_STOCK",
    brand: "Sony",
    region: "IN",
    fetchedAt: new Date().toISOString(),
    attributes: {},
    ...overrides,
  };
}

function item(overrides: Partial<MandateItem> = {}): MandateItem {
  return { listing: listing(), quantity: 1, ...overrides };
}

describe("Purchase Mandate engine", () => {
  test("ALLOW when within budget and clean", () => {
    const evalResult = evaluateMandate(policy, [item()]);
    // 25000 > 100000? No: 2500000 minor = 25000 INR > budget 1000 INR... adjust
    expect(evalResult.decision).toBe("DENY"); // budget is 1000 INR, item 25000 INR
    const bigBudget = { ...policy, budgetMinor: 5000000 };
    const allowed = evaluateMandate(bigBudget, [item()]);
    expect(allowed.decision).toBe("ALLOW");
    expect(allowed.subtotalMinor).toBe(2500000);
    expect(allowed.remainingMinor).toBe(2500000);
    expect(allowed.warnings.some((w) => w.code === "APPROXIMATE_TOTAL")).toBe(true);
    expect(allowed.warnings.some((w) => w.code === "PREFERRED_BRAND_ABSENT")).toBe(false);
  });

  test("DENY on budget exceeded", () => {
    const r = evaluateMandate(policy, [item()]);
    expect(r.decision).toBe("DENY");
    expect(r.violations.some((v) => v.code === "BUDGET_EXCEEDED")).toBe(true);
  });

  test("DENY when min unspent budget would be violated", () => {
    const p = { ...policy, budgetMinor: 300000, minUnspentMinor: 100000 };
    const r = evaluateMandate(p, [item()]); // spends 250000, leaves 50000 < 100000
    expect(r.decision).toBe("DENY");
    expect(r.violations.some((v) => v.code === "MIN_UNSPENT_VIOLATED")).toBe(true);
  });

  test("DENY on excluded brand", () => {
    const r = evaluateMandate(policy, [item({ listing: listing({ brand: "CounterfeitCorp Pro" }) })]);
    expect(r.violations.some((v) => v.code === "EXCLUDED_BRAND")).toBe(true);
  });

  test("DENY on missing required attributes", () => {
    const p = { ...policy, requiredAttributes: { color: "black" }, budgetMinor: 5000000 };
    const r = evaluateMandate(p, [item({ listing: listing({ attributes: { color: "white" } }) })]);
    expect(r.violations.some((v) => v.code === "REQUIRED_ATTRIBUTE_MISSING")).toBe(true);
    const ok = evaluateMandate(p, [item({ listing: listing({ attributes: { color: "black" } }) })]);
    expect(ok.decision).toBe("ALLOW");
  });

  test("quantity and total item limits", () => {
    const p = { ...policy, budgetMinor: 10000000, maxQuantityPerItem: 1 };
    expect(evaluateMandate(p, [item({ quantity: 2 })]).violations.some((v) => v.code === "QUANTITY_LIMIT")).toBe(true);
    const many = Array.from({ length: 6 }, (_, i) =>
      item({ listing: listing({ id: `ebay:${i}`, externalId: String(i) }) })
    );
    expect(evaluateMandate({ ...p, maxTotalItems: 5 }, many).violations.some((v) => v.code === "TOTAL_ITEMS_LIMIT")).toBe(true);
  });

  test("provider allow/exclude and destination rules", () => {
    const p = { ...policy, budgetMinor: 5000000, allowedProviders: ["flipkart"] };
    expect(evaluateMandate(p, [item()]).violations.some((v) => v.code === "PROVIDER_NOT_ALLOWED")).toBe(true);
    const p2 = { ...policy, budgetMinor: 5000000, excludedProviders: ["ebay"] };
    expect(evaluateMandate(p2, [item()]).violations.some((v) => v.code === "PROVIDER_EXCLUDED")).toBe(true);
    const p3 = { ...policy, budgetMinor: 5000000, allowedDestinations: ["US"] };
    expect(evaluateMandate(p3, [item()]).violations.some((v) => v.code === "DESTINATION_NOT_ALLOWED")).toBe(true);
  });

  test("stale listings are blocked", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const r = evaluateMandate(policy, [item({ listing: listing({ fetchedAt: old }) })]);
    expect(r.violations.some((v) => v.code === "STALE_LISTING")).toBe(true);
  });

  test("out of stock denies, unknown warns", () => {
    const oos = evaluateMandate(policy, [item({ listing: listing({ availability: "OUT_OF_STOCK" }) })]);
    expect(oos.violations.some((v) => v.code === "OUT_OF_STOCK")).toBe(true);
    const unk = evaluateMandate(policy, [item({ listing: listing({ availability: "UNKNOWN" }) })]);
    expect(unk.warnings.some((w) => w.code === "UNKNOWN_AVAILABILITY")).toBe(true);
  });

  test("currency mismatch denies", () => {
    const r = evaluateMandate(policy, [
      item({ listing: listing({ price: { amountMinor: 10000, currency: "USD" } }) }),
    ]);
    expect(r.violations.some((v) => v.code === "CURRENCY_MISMATCH")).toBe(true);
  });

  test("price increase after approval requires re-approval; decrease only warns", () => {
    const p = { ...policy, budgetMinor: 10000000 };
    const up = evaluateMandate(p, [item({ approvedPriceMinor: 2000000 })]);
    expect(up.decision).toBe("REQUIRES_APPROVAL");
    expect(up.violations.some((v) => v.code === "PRICE_CHANGED")).toBe(true);
    const down = evaluateMandate(p, [item({ approvedPriceMinor: 3000000 })]);
    expect(down.decision).toBe("ALLOW");
    expect(down.warnings.some((w) => w.code === "PRICE_DECREASED")).toBe(true);
  });

  test("empty plan denies", () => {
    expect(evaluateMandate(policy, []).violations.some((v) => v.code === "EMPTY_PLAN")).toBe(true);
  });
});
