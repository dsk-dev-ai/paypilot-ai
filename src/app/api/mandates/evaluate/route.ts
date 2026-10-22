import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getMandate } from "@/lib/db/mandates";
import { getActiveDraftPlan } from "@/lib/db/plans";
import { getListingRecord } from "@/lib/db/listings";
import { evaluateMandate, type MandateItem, type MandatePolicy } from "@/lib/mandate/engine";
import { isCurrency } from "@/lib/core/money";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const EvaluateSchema = z.object({
  mandateId: z.string().min(1),
  /** Optional explicit listing record ids + quantities; defaults to the active plan. */
  items: z
    .array(
      z.object({
        listingRecordId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .max(100)
    .optional(),
});

/**
 * POST /api/mandates/evaluate — deterministic evaluation of a mandate
 * against the active plan (or an explicit item list). Pure policy engine;
 * the AI never influences this decision.
 */
export async function POST(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = EvaluateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid evaluation request", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }
  const userId = await getSessionUserId();
  const mandate = await getMandate(userId, parsed.data.mandateId);
  if (!mandate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Mandate not found" } }, { status: 404 });
  }

  let items: MandateItem[];
  if (parsed.data.items) {
    items = [];
    for (const it of parsed.data.items) {
      const listing = await getListingRecord(it.listingRecordId);
      if (!listing || listing.price.currency !== mandate.currency) continue;
      items.push({ listing, quantity: it.quantity });
    }
  } else {
    const plan = await getActiveDraftPlan(userId);
    items = (plan?.items ?? []).map((it) => ({
      listing: {
        id: it.listingId,
        provider: it.provider,
        externalId: it.externalId,
        title: it.title,
        canonicalUrl: it.canonicalUrl,
        imageUrl: it.imageUrl,
        price: { amountMinor: it.priceMinor, currency: it.currency as MandatePolicy["currency"] },
        availability: it.availability as MandateItem["listing"]["availability"],
        seller: it.seller,
        brand: it.brand,
        attributes: {},
        region: "IN" as const,
        fetchedAt: it.fetchedAt,
      },
      quantity: it.quantity,
      approvedPriceMinor: it.approvedPriceMinor,
    }));
  }

  const policy: MandatePolicy = {
    budgetMinor: mandate.budgetMinor,
    currency: isCurrency(mandate.currency) ? mandate.currency : "INR",
    minUnspentMinor: mandate.minUnspentMinor,
    preferredBrands: mandate.preferredBrands,
    excludedBrands: mandate.excludedBrands,
    requiredAttributes: mandate.requiredAttributes,
    maxQuantityPerItem: mandate.maxQuantityPerItem,
    maxTotalItems: mandate.maxTotalItems,
    allowedProviders: mandate.allowedProviders,
    excludedProviders: mandate.excludedProviders,
    allowedDestinations: mandate.allowedDestinations,
    maxListingAgeMinutes: mandate.maxListingAgeMinutes,
  };

  const evaluation = evaluateMandate(policy, items);
  return NextResponse.json({ evaluation });
}
