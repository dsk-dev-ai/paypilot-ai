import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getMandate, listMandates, type MandateDTO } from "@/lib/db/mandates";
import { upsertListing } from "@/lib/db/listings";
import { replaceDraftPlan } from "@/lib/db/plans";
import { recordAuditEvent } from "@/lib/db/audit";
import { catalogForPlanner, catalogProductToListing, getCatalogProduct, CATALOG_CURRENCY } from "@/lib/catalog/products";
import { proposePurchase, deterministicProposal, type PlannerMandate } from "@/lib/ai/purchase";
import { evaluateMandate, type MandateItem, type MandatePolicy } from "@/lib/mandate/engine";
import { isCurrency } from "@/lib/core/money";
import { rateLimit } from "@/lib/http/api";
import { searchRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().trim().min(3).max(800),
  mandateId: z.string().trim().min(1).max(120).optional(),
  /** Persist the proposal as the active draft plan. */
  commit: z.boolean().optional().default(false),
  /**
   * When committing a reviewed proposal, send the exact lines back so the
   * persisted plan matches what the human just saw (no second model call, no
   * silent re-selection).
   */
  items: z
    .array(z.object({ productId: z.string().trim().min(1).max(120), quantity: z.number().int().min(1).max(5) }))
    .max(12)
    .optional(),
});

function toPolicy(mandate: MandateDTO): MandatePolicy {
  return {
    budgetMinor: mandate.budgetMinor,
    currency: isCurrency(mandate.currency) ? mandate.currency : "USD",
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
}

/**
 * POST /api/agent/plan — turn a plain-English goal into a grounded purchase
 * proposal. The model only picks catalog ids; this route re-validates every
 * line against the catalog and the human-signed mandate before returning.
 *
 * With `commit: true` it also replaces the active draft plan, so the next step
 * is the normal human approval that issues the SHA-256 consent artifact.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, searchRateLimiter);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Describe a goal in 3–800 characters." } },
      { status: 400 }
    );
  }

  let userId: string | null = null;
  let mandate: MandateDTO | null = null;
  if (isDbConfigured()) {
    userId = await getSessionUserId();
    if (parsed.data.mandateId) {
      mandate = await getMandate(userId, parsed.data.mandateId);
      if (!mandate) {
        return NextResponse.json(
          { error: { code: "MANDATE_NOT_FOUND", message: "That spending mandate does not exist." } },
          { status: 404 }
        );
      }
    } else {
      const all = await listMandates(userId);
      mandate = all.find((m) => m.active) ?? null;
    }
  }

  const plannerMandate: PlannerMandate | null = mandate
    ? {
        name: mandate.name,
        budgetMinor: mandate.budgetMinor,
        currency: mandate.currency,
        maxQuantityPerItem: mandate.maxQuantityPerItem,
        maxTotalItems: mandate.maxTotalItems,
        allowedProviders: mandate.allowedProviders,
        excludedProviders: mandate.excludedProviders,
        preferredBrands: mandate.preferredBrands,
        excludedBrands: mandate.excludedBrands,
      }
    : null;

  const products = catalogForPlanner();
  const maxQty = Math.min(5, mandate?.maxQuantityPerItem ?? 5);
  const normalize = (
    raw: Array<{ productId: string; quantity: number; reason: string }>
  ): Array<{ productId: string; quantity: number; reason: string }> => {
    const seen = new Set<string>();
    const out: Array<{ productId: string; quantity: number; reason: string }> = [];
    for (const item of raw) {
      if (!getCatalogProduct(item.productId) || seen.has(item.productId)) continue;
      seen.add(item.productId);
      out.push({
        productId: item.productId,
        quantity: Math.max(1, Math.min(item.quantity, maxQty)),
        reason: item.reason.slice(0, 240),
      });
      if (out.length >= 8) break;
    }
    return out;
  };

  let source: "gemini" | "deterministic" | "confirmed";
  let reply: string;
  let reasoning: string;
  let aiError: string | undefined;
  let selected: Array<{ productId: string; quantity: number; reason: string }>;

  if (parsed.data.items && parsed.data.items.length > 0) {
    source = "confirmed";
    selected = normalize(
      parsed.data.items.map((item) => ({
        ...item,
        reason: "Confirmed from the reviewed proposal.",
      }))
    );
    reply = `Confirmed ${selected.length} item(s). The exact reviewed lines are now in your draft plan — approve them to issue the consent hash.`;
    reasoning = "Human-reviewed proposal persisted without a second model call.";
  } else {
    const result = await proposePurchase({
      message: parsed.data.message,
      mandate: plannerMandate,
      products,
    });
    source = result.source;
    reply = result.proposal.reply;
    reasoning = result.proposal.reasoning;
    aiError = result.aiError;
    selected = normalize(result.proposal.items);
    if (selected.length === 0) {
      selected = normalize(
        deterministicProposal(parsed.data.message, plannerMandate, products).items.map((item) => ({
          ...item,
          reason: item.reason,
        }))
      );
    }
  }

  const items: MandateItem[] = selected.map((item) => {
    const product = getCatalogProduct(item.productId)!;
    return {
      listing: catalogProductToListing(product, "US"),
      quantity: item.quantity,
      approvedPriceMinor: null,
    };
  });

  const evaluation = mandate ? evaluateMandate(toPolicy(mandate), items) : null;
  const subtotalMinor = items.reduce(
    (acc, it) => acc + it.listing.price.amountMinor * it.quantity,
    0
  );

  const proposedItems = selected.map((item) => {
    const product = getCatalogProduct(item.productId)!;
    return {
      productId: product.id,
      title: product.title,
      tagline: product.tagline,
      description: product.description,
      category: product.category,
      emoji: product.emoji,
      gradient: product.gradient,
      highlights: product.highlights,
      priceMinor: product.priceMinor,
      currency: CATALOG_CURRENCY,
      quantity: item.quantity,
      reason: item.reason,
      deliverable: product.deliverable,
    };
  });

  let planId: string | null = null;
  if (parsed.data.commit) {
    if (!isDbConfigured() || !userId) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Database is required to create a plan." } },
        { status: 503 }
      );
    }
    if (evaluation?.decision === "DENY") {
      return NextResponse.json(
        {
          error: { code: "MANDATE_DENIED", message: "This proposal violates the spending mandate." },
          evaluation,
          proposal: { reply, reasoning, items: proposedItems },
          source,
        },
        { status: 409 }
      );
    }
    const records: Array<{ listingRecordId: string; quantity: number }> = [];
    for (const item of items) {
      const stored = await upsertListing(item.listing);
      records.push({ listingRecordId: stored.recordId, quantity: item.quantity });
    }
    const plan = await replaceDraftPlan(userId, CATALOG_CURRENCY, mandate?.id ?? null, records);
    planId = plan.id;
    await recordAuditEvent("AGENT_PLAN_CREATED", `Agent proposed ${records.length} line(s) within mandate`, {
      userId,
      metadata: {
        planId: plan.id,
        mandateId: mandate?.id ?? null,
        source,
        subtotalMinor,
        currency: CATALOG_CURRENCY,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    source,
    aiError: aiError ?? null,
    reply,
    reasoning,
    items: proposedItems,
    subtotalMinor,
    currency: CATALOG_CURRENCY,
    evaluation,
    mandate: mandate
      ? {
          id: mandate.id,
          name: mandate.name,
          budgetMinor: mandate.budgetMinor,
          currency: mandate.currency,
          maxQuantityPerItem: mandate.maxQuantityPerItem,
          maxTotalItems: mandate.maxTotalItems,
        }
      : null,
    planId,
  });
}
