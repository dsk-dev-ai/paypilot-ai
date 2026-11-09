import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured, getDb } from "@/lib/db/client";
import { getOrder } from "@/lib/db/orders";
import { getConsent } from "@/lib/db/consents";
import { getFulfillment } from "@/lib/db/fulfillments";
import { verifyLedger } from "@/lib/db/ledger";
import { hashConsent } from "@/lib/mandate/consent";

export const dynamic = "force-dynamic";

type Check = { id: string; label: string; ok: boolean; detail: string };

/**
 * GET /api/verify?orderId=... — recompute the consent hash and the ledger
 * chain for one order. This is the receipt verifier: it never trusts a stored
 * boolean, it re-derives the evidence.
 */
export async function GET(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId || orderId.length < 4 || orderId.length > 120) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Provide an orderId to verify." } },
      { status: 400 }
    );
  }

  const userId = await getSessionUserId();
  const order = await getOrder(userId, orderId);
  if (!order) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  }

  const [consent, fulfillment, ledgerVerification] = await Promise.all([
    order.consentId ? getConsent(userId, order.consentId) : Promise.resolve(null),
    getFulfillment(userId, order.id),
    verifyLedger(),
  ]);

  const subjectEntries = await getDb().ledgerEntry.findMany({
    where: { subjectId: order.id },
    orderBy: { seq: "asc" },
  });

  const computedHash = consent ? hashConsent(consent.snapshot) : null;
  const consentHashOk = !!consent && !!computedHash && computedHash === consent.contentHash;
  const orderBindingOk = !!consent && order.consentHash === consent.contentHash;
  const capturedOk = order.state === "PAID" || order.state === "REFUNDED";
  const paypilotOrder = order.items.some((it) => it.provider === "paypilot");
  const fulfillmentOk = !paypilotOrder || !!fulfillment;
  const ledgerHasReceipt = subjectEntries.length > 0;

  const checks: Check[] = [
    {
      id: "consent-hash",
      label: "Consent hash re-derived",
      ok: consentHashOk,
      detail: consentHashOk
        ? "The SHA-256 of the approved cart snapshot matches the stored artifact."
        : "The stored consent artifact does not match its recomputed hash.",
    },
    {
      id: "order-binding",
      label: "Order bound to consent",
      ok: orderBindingOk,
      detail: orderBindingOk
        ? "The order commits to the exact consent hash that was signed."
        : "The order is not bound to the consent artifact.",
    },
    {
      id: "ledger-chain",
      label: "Append-only ledger intact",
      ok: ledgerVerification.ok,
      detail: ledgerVerification.ok
        ? `Chain verified across ${ledgerVerification.count} entries.`
        : `Chain broken at #${ledgerVerification.brokenAtSeq}: ${ledgerVerification.reason ?? "unknown"}`,
    },
    {
      id: "order-receipt",
      label: "Order receipt in ledger",
      ok: ledgerHasReceipt,
      detail: ledgerHasReceipt
        ? `${subjectEntries.length} ledger entr${subjectEntries.length === 1 ? "y" : "ies"} reference this order.`
        : "No ledger entry references this order.",
    },
    {
      id: "payment",
      label: "PayPal payment captured",
      ok: capturedOk,
      detail: capturedOk ? "The order reached PAID after PayPal reported completion." : `Order state is ${order.state}, not captured.`,
    },
    {
      id: "fulfillment",
      label: "Digital delivery issued",
      ok: fulfillmentOk,
      detail: fulfillmentOk
        ? paypilotOrder
          ? `${fulfillment?.items.length ?? 0} deliverable(s) issued after capture.`
          : "No built-in store items in this order."
        : "A PayPilot Store order has no delivery record.",
    },
  ];

  const critical = checks.filter((c) => c.id !== "payment" && c.id !== "fulfillment");
  const ok = critical.every((c) => c.ok) && capturedOk;

  return NextResponse.json({
    ok,
    order,
    fulfillment,
    consent: consent
      ? {
          id: consent.id,
          contentHash: consent.contentHash,
          computedHash,
          decision: consent.decision,
          approvedAt: consent.approvedAt,
          expiresAt: consent.expiresAt,
          consumedAt: consent.consumedAt,
          revokedAt: consent.revokedAt,
          snapshot: consent.snapshot,
        }
      : null,
    ledger: {
      ok: ledgerVerification.ok,
      count: ledgerVerification.count,
      brokenAtSeq: ledgerVerification.brokenAtSeq,
      reason: ledgerVerification.reason,
      entries: subjectEntries.map((e) => ({
        seq: e.seq,
        type: e.type,
        hash: e.hash,
        prevHash: e.prevHash,
        createdAt: e.createdAt.toISOString(),
      })),
    },
    checks,
  });
}
