import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getActiveDraftPlan, getLatestPlanByStatuses, approvePlanSnapshot } from "@/lib/db/plans";
import { getMandate } from "@/lib/db/mandates";
import { evaluateMandate, type MandateItem, type MandatePolicy } from "@/lib/mandate/engine";
import { buildConsentSnapshot, hashConsent, type ConsentDecision } from "@/lib/mandate/consent";
import { createConsent } from "@/lib/db/consents";
import { appendLedgerEntry } from "@/lib/db/ledger";
import { isCurrency } from "@/lib/core/money";
import { recordAuditEvent } from "@/lib/db/audit";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const ApproveSchema = z.object({
  mandateId: z.string().min(1).optional(),
  /** Required when the evaluation result is not ALLOW — explicit user confirmation. */
  confirmWarnings: z.boolean().default(false),
});

/**
 * POST /api/plan/approve — validate the active plan against the mandate,
 * freeze approved price snapshots, then issue a content-addressed consent
 * artifact (the Cart Mandate). DENY blocks approval.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = ApproveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid approval request" } }, { status: 400 });
  }
  const userId = await getSessionUserId();
  const plan =
    (await getActiveDraftPlan(userId)) ??
    (await getLatestPlanByStatuses(userId, ["APPROVED"]));
  if (!plan || plan.items.length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_PLAN", message: "The plan has no items to approve." } },
      { status: 400 }
    );
  }
  if (plan.status === "CHECKOUT_IN_PROGRESS" || plan.status === "CHECKED_OUT" || plan.status === "CANCELED") {
    return NextResponse.json(
      { error: { code: "PLAN_CLOSED", message: `This plan is ${plan.status} and cannot be re-approved.` } },
      { status: 409 }
    );
  }

  let mandate = null;
  if (parsed.data.mandateId) {
    mandate = await getMandate(userId, parsed.data.mandateId);
    if (!mandate) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Mandate not found" } }, { status: 404 });
    }
    if (!mandate.active) {
      return NextResponse.json({ error: { code: "MANDATE_INACTIVE", message: "This mandate is inactive." } }, { status: 409 });
    }
  }

  let evaluation: ReturnType<typeof evaluateMandate> | null = null;
  let decision: ConsentDecision = "NO_MANDATE";

  if (mandate) {
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
    const items: MandateItem[] = plan.items.map((it) => ({
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
    evaluation = evaluateMandate(policy, items);
    if (evaluation.decision === "DENY") {
      return NextResponse.json(
        { error: { code: "MANDATE_DENIED", message: "The plan violates the Purchase Mandate." }, evaluation },
        { status: 409 }
      );
    }
    if (evaluation.decision === "REQUIRES_APPROVAL" && !parsed.data.confirmWarnings) {
      return NextResponse.json(
        {
          error: {
            code: "REQUIRES_APPROVAL",
            message: "Prices changed since the last approval. Confirm to approve at current prices.",
          },
          evaluation,
        },
        { status: 409 }
      );
    }
    decision = evaluation.decision;
  }

  const approved = await approvePlanSnapshot(userId, plan.id);
  if (!approved) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Plan not found." } }, { status: 404 });
  }

  const snapshot = buildConsentSnapshot({
    plan: approved,
    mandateId: mandate?.id ?? null,
    decision,
  });
  const contentHash = hashConsent(snapshot);
  const consent = await createConsent({
    userId,
    planId: approved.id,
    mandateId: mandate?.id ?? null,
    snapshot,
    contentHash,
  });

  await appendLedgerEntry({
    type: "CONSENT_GRANTED",
    userId,
    subjectId: consent.id,
    detail: {
      planId: approved.id,
      mandateId: mandate?.id ?? null,
      contentHash,
      subtotalMinor: snapshot.subtotalMinor,
      currency: snapshot.currency,
      itemCount: snapshot.itemCount,
      decision,
    },
  }).catch(() => undefined);

  await recordAuditEvent(
    "PLAN_APPROVED",
    mandate ? `Plan approved against mandate ${mandate.name}` : "Plan approved without mandate",
    {
      userId,
      metadata: {
        planId: approved.id,
        mandateId: mandate?.id ?? null,
        subtotalMinor: snapshot.subtotalMinor,
        consentId: consent.id,
        consentHash: contentHash,
      },
    }
  );

  return NextResponse.json({ plan: approved, evaluation, consent });
}

/** DELETE /api/plan/approve is not used; cancel via /api/plan/cancel. */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const userId = await getSessionUserId();
  const plan = await getActiveDraftPlan(userId);
  return NextResponse.json({ plan });
}
