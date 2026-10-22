import { canonicalJson, equalHex, sha256Hex } from "@/lib/core/canonical";
import type { PlanDTO } from "@/lib/db/plans";

export const CONSENT_VERSION = 1;
export const CONSENT_TTL_MS = 10 * 60 * 1000;

export type ConsentDecision = "ALLOW" | "REQUIRES_APPROVAL" | "NO_MANDATE";

export type ConsentItem = {
  listingId: string;
  provider: string;
  externalId: string;
  title: string;
  canonicalUrl: string;
  unitPriceMinor: number;
  quantity: number;
  currency: string;
};

/**
 * The exact cart a human approved. This is the Cart Mandate: a content hash
 * over every line item, quantity, unit price, merchant and total.
 */
export type ConsentSnapshot = {
  version: typeof CONSENT_VERSION;
  planId: string;
  mandateId: string | null;
  currency: string;
  items: ConsentItem[];
  subtotalMinor: number;
  itemCount: number;
  decision: ConsentDecision;
  approvedAt: string;
  expiresAt: string;
};

export type ConsentMismatch = {
  listingId: string;
  reason: string;
};

export function buildConsentSnapshot(input: {
  plan: PlanDTO;
  mandateId: string | null;
  decision: ConsentDecision;
  approvedAt?: Date;
  ttlMs?: number;
}): ConsentSnapshot {
  const approvedAt = input.approvedAt ?? new Date();
  const expiresAt = new Date(approvedAt.getTime() + (input.ttlMs ?? CONSENT_TTL_MS));
  const items: ConsentItem[] = input.plan.items.map((it) => ({
    listingId: it.listingId,
    provider: it.provider,
    externalId: it.externalId,
    title: it.title,
    canonicalUrl: it.canonicalUrl,
    unitPriceMinor: it.approvedPriceMinor ?? it.priceMinor,
    quantity: it.quantity,
    currency: it.currency,
  }));
  const subtotalMinor = items.reduce((acc, it) => acc + it.unitPriceMinor * it.quantity, 0);
  return {
    version: CONSENT_VERSION,
    planId: input.plan.id,
    mandateId: input.mandateId,
    currency: input.plan.currency,
    items,
    subtotalMinor,
    itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
    decision: input.decision,
    approvedAt: approvedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function hashConsent(snapshot: ConsentSnapshot): string {
  return sha256Hex(canonicalJson(snapshot));
}

export function verifyConsent(
  snapshot: ConsentSnapshot,
  expectedHash: string
): { ok: boolean; actualHash: string } {
  const actualHash = hashConsent(snapshot);
  return { ok: equalHex(actualHash, expectedHash), actualHash };
}

export function isConsentExpired(snapshot: ConsentSnapshot, now = Date.now()): boolean {
  return new Date(snapshot.expiresAt).getTime() <= now;
}

/**
 * Compare the approved artifact with the live plan. Checkout must refuse when
 * anything about the cart changed after approval: quantities, prices, merchant,
 * listing identity, currency, or total.
 */
export function consentMatchesPlan(
  snapshot: ConsentSnapshot,
  plan: PlanDTO
): { ok: boolean; mismatches: ConsentMismatch[] } {
  const mismatches: ConsentMismatch[] = [];
  if (snapshot.planId !== plan.id) {
    mismatches.push({ listingId: "*", reason: `snapshot is for plan ${snapshot.planId}, not ${plan.id}` });
  }
  if (snapshot.currency !== plan.currency) {
    mismatches.push({ listingId: "*", reason: `currency changed: ${snapshot.currency} -> ${plan.currency}` });
  }
  if (snapshot.items.length !== plan.items.length) {
    mismatches.push({
      listingId: "*",
      reason: `line count changed: ${snapshot.items.length} -> ${plan.items.length}`,
    });
  }

  const live = new Map(plan.items.map((it) => [it.listingId, it]));
  for (const approved of snapshot.items) {
    const current = live.get(approved.listingId);
    if (!current) {
      mismatches.push({ listingId: approved.listingId, reason: "item is no longer in the plan" });
      continue;
    }
    if (current.provider !== approved.provider) {
      mismatches.push({ listingId: approved.listingId, reason: "provider changed" });
    }
    if (current.externalId !== approved.externalId) {
      mismatches.push({ listingId: approved.listingId, reason: "listing identity changed" });
    }
    if (current.quantity !== approved.quantity) {
      mismatches.push({
        listingId: approved.listingId,
        reason: `quantity changed: ${approved.quantity} -> ${current.quantity}`,
      });
    }
    if (current.currency !== approved.currency) {
      mismatches.push({ listingId: approved.listingId, reason: "currency changed" });
    }
    if (current.approvedPriceMinor == null) {
      mismatches.push({ listingId: approved.listingId, reason: "item is not approved" });
    } else if (current.approvedPriceMinor !== approved.unitPriceMinor) {
      mismatches.push({
        listingId: approved.listingId,
        reason: `approved unit price changed: ${approved.unitPriceMinor} -> ${current.approvedPriceMinor}`,
      });
    }
    if (current.priceMinor !== approved.unitPriceMinor) {
      mismatches.push({ listingId: approved.listingId, reason: "live price differs from approved price" });
    }
  }

  const liveSubtotal = plan.items.reduce(
    (acc, it) => acc + (it.approvedPriceMinor ?? it.priceMinor) * it.quantity,
    0
  );
  if (liveSubtotal !== snapshot.subtotalMinor) {
    mismatches.push({
      listingId: "*",
      reason: `subtotal changed: ${snapshot.subtotalMinor} -> ${liveSubtotal}`,
    });
  }

  return { ok: mismatches.length === 0, mismatches };
}
