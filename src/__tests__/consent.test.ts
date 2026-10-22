import { describe, expect, test } from "vitest";
import {
  buildConsentSnapshot,
  consentMatchesPlan,
  hashConsent,
  isConsentExpired,
  verifyConsent,
  type ConsentSnapshot,
} from "@/lib/mandate/consent";
import type { PlanDTO, PlanItemDTO } from "@/lib/db/plans";

function item(overrides: Partial<PlanItemDTO> = {}): PlanItemDTO {
  return {
    id: "pi_1",
    listingRecordId: "lr_1",
    listingId: "ebay:abc",
    provider: "ebay",
    externalId: "abc",
    title: "Test Item",
    canonicalUrl: "https://example.com/item",
    priceMinor: 1999,
    currency: "USD",
    availability: "IN_STOCK",
    quantity: 2,
    approvedPriceMinor: 1999,
    approvedAt: "2026-10-22T00:00:00.000Z",
    addedAt: "2026-10-22T00:00:00.000Z",
    fetchedAt: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

function plan(overrides: Partial<PlanDTO> = {}): PlanDTO {
  return {
    id: "plan_1",
    userId: "u_1",
    name: "Plan",
    status: "APPROVED",
    currency: "USD",
    mandateId: null,
    items: [item()],
    subtotalMinor: 3998,
    updatedAt: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(overrides: Partial<PlanDTO> = {}): ConsentSnapshot {
  return buildConsentSnapshot({
    plan: plan(overrides),
    mandateId: "m_1",
    decision: "ALLOW",
    approvedAt: new Date("2026-10-22T00:00:00.000Z"),
    ttlMs: 60_000,
  });
}

describe("consent artifact", () => {
  test("binds plan, items, quantities and total into a stable SHA-256 hash", () => {
    const a = snapshot();
    const b = snapshot();
    expect(a.subtotalMinor).toBe(3998);
    expect(a.itemCount).toBe(2);
    expect(hashConsent(a)).toBe(hashConsent(b));
    expect(hashConsent(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("hash changes when any cart fact changes", () => {
    const base = hashConsent(snapshot());
    const qty = hashConsent(snapshot({ items: [item({ quantity: 3 })], subtotalMinor: 5997 }));
    const price = hashConsent(snapshot({ items: [item({ priceMinor: 2000, approvedPriceMinor: 2000 })] }));
    expect(qty).not.toBe(base);
    expect(price).not.toBe(base);
  });

  test("detects a tampered snapshot", () => {
    const s = snapshot();
    const hash = hashConsent(s);
    const tampered: ConsentSnapshot = {
      ...s,
      items: [{ ...s.items[0], unitPriceMinor: 1 }],
      subtotalMinor: 2,
    };
    expect(verifyConsent(s, hash).ok).toBe(true);
    expect(verifyConsent(tampered, hash).ok).toBe(false);
  });

  test("expires at the approved TTL", () => {
    const s = snapshot();
    expect(isConsentExpired(s, new Date("2026-10-22T00:00:30.000Z").getTime())).toBe(false);
    expect(isConsentExpired(s, new Date("2026-10-22T00:01:00.000Z").getTime())).toBe(true);
  });
});

describe("consentMatchesPlan", () => {
  test("accepts the exact approved cart", () => {
    expect(consentMatchesPlan(snapshot(), plan())).toEqual({ ok: true, mismatches: [] });
  });

  test("rejects a quantity change after approval", () => {
    const result = consentMatchesPlan(snapshot(), plan({ items: [item({ quantity: 3 })] }));
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.reason.includes("quantity changed"))).toBe(true);
  });

  test("rejects a live or approved price change", () => {
    const live = consentMatchesPlan(snapshot(), plan({ items: [item({ priceMinor: 2100 })] }));
    expect(live.ok).toBe(false);
    expect(live.mismatches.some((m) => m.reason.includes("live price"))).toBe(true);

    const approved = consentMatchesPlan(
      snapshot(),
      plan({ items: [item({ approvedPriceMinor: 2100, priceMinor: 2100 })] })
    );
    expect(approved.ok).toBe(false);
    expect(approved.mismatches.some((m) => m.reason.includes("approved unit price"))).toBe(true);
  });

  test("rejects an item removed from the plan", () => {
    const result = consentMatchesPlan(snapshot(), plan({ items: [] }));
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.reason.includes("line count"))).toBe(true);
  });
});
