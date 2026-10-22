import { addMoney, cmpMoney, mulInt, money, subMoney, zeroMoney, type Currency } from "@/lib/core/money";
import type { ProductListing } from "@/lib/core/listing";

export type MandatePolicy = {
  budgetMinor: number;
  currency: Currency;
  minUnspentMinor: number;
  preferredBrands: string[];
  excludedBrands: string[];
  requiredAttributes: Record<string, string | number | boolean>;
  maxQuantityPerItem: number;
  maxTotalItems: number;
  allowedProviders: string[];
  excludedProviders: string[];
  allowedDestinations: string[];
  maxListingAgeMinutes: number;
};

export type MandateItem = {
  listing: ProductListing;
  quantity: number;
  /** Approved snapshot price, if the item was approved earlier. */
  approvedPriceMinor?: number | null;
};

export type MandateViolation = {
  code:
    | "BUDGET_EXCEEDED"
    | "MIN_UNSPENT_VIOLATED"
    | "CURRENCY_MISMATCH"
    | "EXCLUDED_BRAND"
    | "REQUIRED_ATTRIBUTE_MISSING"
    | "QUANTITY_LIMIT"
    | "TOTAL_ITEMS_LIMIT"
    | "PROVIDER_NOT_ALLOWED"
    | "PROVIDER_EXCLUDED"
    | "DESTINATION_NOT_ALLOWED"
    | "STALE_LISTING"
    | "OUT_OF_STOCK"
    | "PRICE_CHANGED"
    | "EMPTY_PLAN";
  message: string;
  listingId?: string;
};

export type MandateWarning = {
  code: "PRICE_INCREASED" | "PRICE_DECREASED" | "UNKNOWN_AVAILABILITY" | "PREFERRED_BRAND_ABSENT" | "APPROXIMATE_TOTAL";
  message: string;
  listingId?: string;
};

export type MandateEvaluation = {
  decision: "ALLOW" | "DENY" | "REQUIRES_APPROVAL";
  violations: MandateViolation[];
  warnings: MandateWarning[];
  subtotalMinor: number;
  budgetMinor: number;
  remainingMinor: number;
  currency: Currency;
  itemCount: number;
  evaluatedAt: string;
};

function brandMatches(listingBrand: string | undefined, patterns: string[]): boolean {
  if (!listingBrand) return false;
  const b = listingBrand.toLowerCase();
  return patterns.some((p) => b.includes(p.toLowerCase()));
}

/**
 * Deterministic Purchase Mandate evaluation. Pure function — no I/O,
 * no AI. Blocking problems are violations (DENY); recoverable concerns
 * are warnings or REQUIRES_APPROVAL.
 */
export function evaluateMandate(policy: MandatePolicy, items: MandateItem[]): MandateEvaluation {
  const violations: MandateViolation[] = [];
  const warnings: MandateWarning[] = [];
  const now = Date.now();

  let subtotal = zeroMoney(policy.currency);
  let itemCount = 0;

  if (items.length === 0) {
    violations.push({ code: "EMPTY_PLAN", message: "The shopping plan has no items." });
  }

  for (const item of items) {
    const l = item.listing;
    const qty = item.quantity;
    itemCount += qty;

    if (l.price.currency !== policy.currency) {
      violations.push({
        code: "CURRENCY_MISMATCH",
        message: `Listing is priced in ${l.price.currency} but the mandate currency is ${policy.currency}.`,
        listingId: l.id,
      });
      continue;
    }

    if (brandMatches(l.brand, policy.excludedBrands)) {
      violations.push({
        code: "EXCLUDED_BRAND",
        message: `Brand "${l.brand}" is excluded by this mandate.`,
        listingId: l.id,
      });
    }

    for (const [key, expected] of Object.entries(policy.requiredAttributes)) {
      const actual = l.attributes[key];
      if (actual === undefined || actual === null || String(actual).toLowerCase() !== String(expected).toLowerCase()) {
        violations.push({
          code: "REQUIRED_ATTRIBUTE_MISSING",
          message: `Required attribute ${key}=${String(expected)} not present (got: ${actual === undefined ? "nothing" : String(actual)}).`,
          listingId: l.id,
        });
      }
    }

    if (qty > policy.maxQuantityPerItem) {
      violations.push({
        code: "QUANTITY_LIMIT",
        message: `Quantity ${qty} exceeds the per-item limit of ${policy.maxQuantityPerItem}.`,
        listingId: l.id,
      });
    }

    if (policy.allowedProviders.length > 0 && !policy.allowedProviders.includes(l.provider)) {
      violations.push({
        code: "PROVIDER_NOT_ALLOWED",
        message: `Provider "${l.provider}" is not in the allowed provider list.`,
        listingId: l.id,
      });
    }

    if (policy.excludedProviders.includes(l.provider)) {
      violations.push({
        code: "PROVIDER_EXCLUDED",
        message: `Provider "${l.provider}" is excluded by this mandate.`,
        listingId: l.id,
      });
    }

    if (policy.allowedDestinations.length > 0 && !policy.allowedDestinations.includes(l.region)) {
      violations.push({
        code: "DESTINATION_NOT_ALLOWED",
        message: `Ships to/sells in region "${l.region}" which is not allowed.`,
        listingId: l.id,
      });
    }

    const ageMinutes = (now - new Date(l.fetchedAt).getTime()) / 60000;
    if (ageMinutes > policy.maxListingAgeMinutes) {
      violations.push({
        code: "STALE_LISTING",
        message: `Listing data is ${Math.floor(ageMinutes)} minutes old (max ${policy.maxListingAgeMinutes}). Re-run search before checkout.`,
        listingId: l.id,
      });
    }

    if (l.availability === "OUT_OF_STOCK") {
      violations.push({ code: "OUT_OF_STOCK", message: "Item is out of stock.", listingId: l.id });
    } else if (l.availability === "UNKNOWN") {
      warnings.push({ code: "UNKNOWN_AVAILABILITY", message: "Stock status is unknown at the source.", listingId: l.id });
    }

    if (item.approvedPriceMinor != null && item.approvedPriceMinor !== l.price.amountMinor) {
      const diff = l.price.amountMinor - item.approvedPriceMinor;
      if (diff > 0) {
        violations.push({
          code: "PRICE_CHANGED",
          message: `Price increased since approval; re-approval required.`,
          listingId: l.id,
        });
      } else {
        warnings.push({ code: "PRICE_DECREASED", message: "Price decreased since approval.", listingId: l.id });
      }
    }

    if (brandMatches(l.brand, policy.preferredBrands)) {
      // informational only
    }

    subtotal = addMoney(subtotal, mulInt(money(l.price.currency, l.price.amountMinor), qty));
  }

  if (itemCount > policy.maxTotalItems) {
    violations.push({
      code: "TOTAL_ITEMS_LIMIT",
      message: `Plan has ${itemCount} items; the mandate allows ${policy.maxTotalItems}.`,
    });
  }

  if (cmpMoney(subtotal, money(policy.currency, policy.budgetMinor)) > 0) {
    violations.push({
      code: "BUDGET_EXCEEDED",
      message: `Subtotal exceeds the budget of ${(policy.budgetMinor / 100).toFixed(2)} ${policy.currency}.`,
    });
  }

  const remaining = subMoney(money(policy.currency, policy.budgetMinor), subtotal);
  if (cmpMoney(remaining, money(policy.currency, policy.minUnspentMinor)) < 0) {
    violations.push({
      code: "MIN_UNSPENT_VIOLATED",
      message: `Unspent budget ${(remaining.amountMinor / 100).toFixed(2)} is below the required minimum of ${(policy.minUnspentMinor / 100).toFixed(2)}.`,
    });
  }

  if (items.length > 0 && !items.some((it) => brandMatches(it.listing.brand, policy.preferredBrands)) && policy.preferredBrands.length > 0) {
    warnings.push({ code: "PREFERRED_BRAND_ABSENT", message: "No preferred-brand items in the plan." });
  }
  warnings.push({ code: "APPROXIMATE_TOTAL", message: "Shipping and taxes are not included; final retailer total may differ." });

  const blocking = violations.filter((v) => v.code !== "PRICE_CHANGED");
  const priceChanged = violations.some((v) => v.code === "PRICE_CHANGED");

  let decision: MandateEvaluation["decision"] = "ALLOW";
  if (blocking.length > 0) decision = "DENY";
  else if (priceChanged) decision = "REQUIRES_APPROVAL";

  return {
    decision,
    violations,
    warnings,
    subtotalMinor: subtotal.amountMinor,
    budgetMinor: policy.budgetMinor,
    remainingMinor: remaining.amountMinor,
    currency: policy.currency,
    itemCount,
    evaluatedAt: new Date().toISOString(),
  };
}
