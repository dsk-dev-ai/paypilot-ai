import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getPlan, getLatestPlanByStatuses, setPlanStatus, type PlanDTO, type PlanItemDTO } from "@/lib/db/plans";
import { createOrder, transitionOrder, recordPaymentAttempt, type OrderDTO } from "@/lib/db/orders";
import { createHandoff, listHandoffsForOrder, type HandoffDTO } from "@/lib/db/handoffs";
import { getConsent, getLatestConsent, consumeConsent } from "@/lib/db/consents";
import { appendLedgerEntry } from "@/lib/db/ledger";
import { consentMatchesPlan, isConsentExpired, verifyConsent } from "@/lib/mandate/consent";
import { sha256Hex } from "@/lib/core/canonical";
import { ensureProvidersRegistered } from "@/lib/providers";
import { getProvider } from "@/lib/providers/registry";
import { routeCheckout, type CheckoutIntent, type CheckoutPlanItem } from "@/lib/checkout/router";
import { getPayPalStatus, PAYPAL_SUPPORTED_CURRENCIES } from "@/modules/payments/config";
import { createPayPalOrder, getApproveUrl } from "@/modules/payments/client";
import { recordAuditEvent } from "@/lib/db/audit";
import type { ProviderCapabilities } from "@/lib/core/provider";
import { rateLimit } from "@/lib/http/api";
import { checkoutRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  return null;
}

function toCheckoutItems(items: PlanItemDTO[]): CheckoutPlanItem[] {
  return items.map((it) => ({
    provider: it.provider,
    currency: it.currency,
    priceMinor: it.approvedPriceMinor ?? it.priceMinor,
    quantity: it.quantity,
    canonicalUrl: it.canonicalUrl,
  }));
}

async function computeIntents(plan: PlanDTO): Promise<CheckoutIntent[]> {
  await ensureProvidersRegistered();
  const capabilities: Record<string, ProviderCapabilities | undefined> = {};
  for (const it of plan.items) {
    const p = getProvider(it.provider);
    if (p && !capabilities[it.provider]) capabilities[it.provider] = p.getStatus().capabilities;
  }
  const pp = getPayPalStatus();
  const configured = pp.state === "CONFIGURED" || pp.state === "VERIFIED";
  return routeCheckout(toCheckoutItems(plan.items), capabilities, {
    configured,
    supportedCurrencies: [...PAYPAL_SUPPORTED_CURRENCIES],
    environment: pp.label.includes("production") ? "production" : "sandbox",
  });
}

type CheckoutSummary = {
  planId: string;
  intents: Array<
    CheckoutIntent & {
      orderId: string | null;
      orderState: string | null;
      handoffId: string | null;
      handoffState: string | null;
      approveUrl: string | null;
    }
  >;
};

async function buildSummary(userId: string, plan: PlanDTO): Promise<CheckoutSummary> {
  const intents = await computeIntents(plan);
  const { getDb } = await import("@/lib/db/client");
  const orders = await getDb().order.findMany({
    where: { userId, planId: plan.id },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  const enriched = await Promise.all(
    intents.map(async (intent) => {
      const order = orders.find((o) =>
        o.items.some((it) => it.provider === intent.provider)
      );
      if (!order) {
        return { ...intent, orderId: null, orderState: null, handoffId: null, handoffState: null, approveUrl: null };
      }
      const handoffs = await listHandoffsForOrder(userId, order.id);
      const handoff = handoffs.find((h) => h.provider === intent.provider) ?? null;
      return {
        ...intent,
        orderId: order.id,
        orderState: order.state,
        handoffId: handoff?.id ?? null,
        handoffState: handoff?.state ?? null,
        approveUrl: null,
      };
    })
  );
  return { planId: plan.id, intents: enriched };
}

/** GET /api/checkout — current checkout state for the latest approved/in-progress plan. */
export async function GET() {
  const g = guard();
  if (g) return g;
  const userId = await getSessionUserId();
  const plan = await getLatestPlanByStatuses(userId, ["APPROVED", "CHECKOUT_IN_PROGRESS", "CHECKED_OUT"]);
  if (!plan) return NextResponse.json({ plan: null, checkout: null, consent: null });
  const [checkout, consent] = await Promise.all([
    buildSummary(userId, plan),
    getLatestConsent(userId, plan.id),
  ]);
  return NextResponse.json({ plan, checkout, consent });
}

/**
 * POST /api/checkout — route the approved plan into per-merchant orders.
 * - Requires a valid, unexpired, tamper-free consent artifact for this exact cart.
 * - Price changes since approval require re-approval (a new consent hash).
 * - Idempotent per plan+provider via order idempotency keys.
 * - EXTERNAL_CHECKOUT: records a handoff to the merchant's official site.
 * - PAYPILOT_PAYPAL: creates a real PayPal order (sandbox) for buyer approval.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, checkoutRateLimiter);
  if (limited) return limited;
  const g = guard();
  if (g) return g;
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const body = json as { planId?: string; consentId?: string };
  const userId = await getSessionUserId();

  const plan = body.planId
    ? await getPlan(userId, body.planId)
    : await getLatestPlanByStatuses(userId, ["APPROVED", "CHECKOUT_IN_PROGRESS"]);
  if (!plan) {
    return NextResponse.json(
      { error: { code: "NO_APPROVED_PLAN", message: "Approve a shopping plan before checkout." } },
      { status: 400 }
    );
  }
  if (plan.status === "CHECKED_OUT" || plan.status === "CANCELED") {
    return NextResponse.json(
      { error: { code: "PLAN_CLOSED", message: `This plan is ${plan.status} and cannot be checked out again.` } },
      { status: 409 }
    );
  }
  if (plan.items.length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_PLAN", message: "The plan has no items." } }, { status: 400 });
  }

  // Snapshot integrity: prices may have changed since approval.
  const changed = plan.items.filter(
    (it) => it.approvedPriceMinor != null && it.approvedPriceMinor !== it.priceMinor
  );
  if (changed.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "PRICE_CHANGED",
          message: `${changed.length} item(s) changed price since approval. Re-approve the plan to issue a new consent artifact.`,
        },
        changedItems: changed.map((it) => ({
          listingId: it.listingId,
          title: it.title,
          approvedPriceMinor: it.approvedPriceMinor,
          currentPriceMinor: it.priceMinor,
          currency: it.currency,
        })),
      },
      { status: 409 }
    );
  }

  const consent = body.consentId
    ? await getConsent(userId, body.consentId)
    : await getLatestConsent(userId, plan.id);
  if (!consent) {
    return NextResponse.json(
      {
        error: {
          code: "CONSENT_REQUIRED",
          message: "Approve the plan first so a signed consent artifact can bind this exact cart.",
        },
      },
      { status: 428 }
    );
  }
  if (consent.planId !== plan.id) {
    return NextResponse.json(
      { error: { code: "CONSENT_PLAN_MISMATCH", message: "This consent belongs to a different plan." } },
      { status: 409 }
    );
  }
  if (consent.revokedAt) {
    return NextResponse.json(
      { error: { code: "CONSENT_REVOKED", message: "This consent was replaced by a newer approval." } },
      { status: 409 }
    );
  }
  if (consent.consumedAt) {
    if (plan.status === "CHECKOUT_IN_PROGRESS") {
      const summary = await buildSummary(userId, plan);
      return NextResponse.json({ plan, checkout: summary, consent, idempotent: true });
    }
    return NextResponse.json(
      { error: { code: "CONSENT_CONSUMED", message: "This consent was already used. Approve the plan again." } },
      { status: 409 }
    );
  }
  if (isConsentExpired(consent.snapshot)) {
    return NextResponse.json(
      { error: { code: "CONSENT_EXPIRED", message: "This consent expired. Approve the plan again." } },
      { status: 409 }
    );
  }
  const hashCheck = verifyConsent(consent.snapshot, consent.contentHash);
  if (!hashCheck.ok) {
    return NextResponse.json(
      { error: { code: "CONSENT_TAMPERED", message: "The consent artifact failed its hash check." } },
      { status: 409 }
    );
  }
  const match = consentMatchesPlan(consent.snapshot, plan);
  if (!match.ok) {
    return NextResponse.json(
      {
        error: {
          code: "CONSENT_MISMATCH",
          message: "The cart changed since approval. Re-approve the plan to issue a new consent artifact.",
        },
        mismatches: match.mismatches,
      },
      { status: 409 }
    );
  }

  await appendLedgerEntry({
    type: "CONSENT_VERIFIED",
    userId,
    subjectId: consent.id,
    detail: {
      planId: plan.id,
      contentHash: consent.contentHash,
      subtotalMinor: consent.subtotalMinor,
      currency: consent.currency,
      itemCount: consent.itemCount,
    },
  }).catch(() => undefined);

  const intents = await computeIntents(plan);
  const results: CheckoutSummary["intents"] = [];
  const { getDb } = await import("@/lib/db/client");

  for (const intent of intents) {
    const subtotal = intent.items.reduce((a, it) => a + it.priceMinor * it.quantity, 0);
    const order: OrderDTO = await createOrder({
      userId,
      planId: plan.id,
      currency: intent.currency,
      subtotalMinor: subtotal,
      totalMinor: subtotal,
      amountIsEstimate: true,
      idempotencyKey: `plan:${plan.id}:${intent.provider}`,
      consentId: consent.id,
      consentHash: consent.contentHash,
      items: intent.items.map((it) => {
        const planItem = plan.items.find(
          (p) => p.provider === it.provider && p.priceMinor === it.priceMinor && p.quantity === it.quantity
        );
        return {
          listingRecordId: planItem?.listingRecordId,
          title: planItem?.title ?? `${it.provider} item`,
          provider: it.provider,
          externalId: planItem?.externalId ?? "",
          canonicalUrl: it.canonicalUrl,
          quantity: it.quantity,
          unitPriceMinor: it.priceMinor,
        };
      }),
    });

    await appendLedgerEntry({
      type: "ORDER_CREATED",
      userId,
      subjectId: order.id,
      detail: {
        planId: plan.id,
        orderId: order.id,
        provider: intent.provider,
        method: intent.method,
        subtotalMinor: subtotal,
        currency: intent.currency,
        consentHash: consent.contentHash,
      },
    }).catch(() => undefined);

    if (intent.method === "EXTERNAL_CHECKOUT") {
      const existing = await listHandoffsForOrder(userId, order.id);
      let handoff: HandoffDTO | null = existing.find((h) => h.provider === intent.provider) ?? null;
      if (!handoff) {
        handoff = await createHandoff({ userId, provider: intent.provider, url: intent.officialUrl, orderId: order.id });
      }
      results.push({
        ...intent,
        orderId: order.id,
        orderState: order.state,
        handoffId: handoff.id,
        handoffState: handoff.state,
        approveUrl: null,
      });
    } else {
      // PAYPILOT_PAYPAL — real sandbox order via PayPal REST.
      const dbOrder = await getDb().order.findFirst({
        where: { id: order.id, userId },
        include: { paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const prior = dbOrder?.paymentAttempts?.find((a) => a.provider === "paypal" && a.status === "PAYER_ACTION_REQUIRED");
      let paypalOrderId = prior?.providerReference ?? null;
      let approveUrl: string | null = null;
      if (!paypalOrderId) {
        try {
          const requestId = `mandate_${sha256Hex(`${plan.id}:${intent.provider}:${consent.contentHash}`).slice(0, 48)}`;
          const ppOrder = await createPayPalOrder(
            {
              amount: (subtotal / 100).toFixed(2),
              currency_code: intent.currency,
              description: `Mandate plan ${plan.id} — ${intent.provider} (${intent.items.length} lines)`,
            },
            requestId
          );
          paypalOrderId = ppOrder.id;
          approveUrl = getApproveUrl(ppOrder);
          await recordPaymentAttempt({
            orderId: order.id,
            provider: "paypal",
            status: "PAYER_ACTION_REQUIRED",
            amountMinor: subtotal,
            currency: intent.currency,
            providerReference: ppOrder.id,
          });
          await transitionOrder(userId, order.id, "PENDING_APPROVAL", {
            paymentProvider: "paypal",
            providerReference: ppOrder.id,
          });
        } catch (e) {
          await recordPaymentAttempt({
            orderId: order.id,
            provider: "paypal",
            status: "FAILED",
            amountMinor: subtotal,
            currency: intent.currency,
            failureMessage: e instanceof Error ? e.message : "PayPal order creation failed",
          });
          return NextResponse.json(
            {
              error: {
                code: "PAYPAL_ERROR",
                message: `PayPal order creation failed for ${intent.provider}: ${e instanceof Error ? e.message : "unknown error"}`,
              },
            },
            { status: 502 }
          );
        }
      }
      results.push({
        ...intent,
        orderId: order.id,
        orderState: "PENDING_APPROVAL",
        handoffId: null,
        handoffState: null,
        approveUrl,
      });
    }
  }

  await consumeConsent(userId, consent.id).catch(() => undefined);
  const updatedPlan = await setPlanStatus(userId, plan.id, "CHECKOUT_IN_PROGRESS");
  await recordAuditEvent("CHECKOUT_STARTED", `Checkout started for plan ${plan.id}`, {
    userId,
    metadata: {
      planId: plan.id,
      merchantCount: intents.length,
      methods: intents.map((i) => `${i.provider}:${i.method}`).join(","),
      consentHash: consent.contentHash,
    },
  });

  return NextResponse.json({ plan: updatedPlan, checkout: { planId: plan.id, intents: results }, consent });
}
