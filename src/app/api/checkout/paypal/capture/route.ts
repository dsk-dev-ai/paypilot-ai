import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getOrder, transitionOrder, recordPaymentAttempt, type OrderState } from "@/lib/db/orders";
import { getConsent } from "@/lib/db/consents";
import { appendLedgerEntry } from "@/lib/db/ledger";
import { sha256Hex } from "@/lib/core/canonical";
import { getPayPalStatus } from "@/modules/payments/config";
import { capturePayPalOrder } from "@/modules/payments/client";
import { recordAuditEvent } from "@/lib/db/audit";
import { rateLimit } from "@/lib/http/api";
import { checkoutRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  orderId: z.string().min(8).max(64),
  /** PayPal order id from the buyer-approval redirect (`token` query param). */
  paypalOrderId: z.string().min(8).max(64),
});

/**
 * POST /api/checkout/paypal/capture — verify and capture a PayPal sandbox
 * order for one of Mandate's internal orders. Idempotent.
 *
 * The order must be bound to a consent artifact, and the database state
 * machine must walk PENDING_APPROVAL -> APPROVED -> CAPTURING -> PAID.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, checkoutRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const status = getPayPalStatus();
  if (status.state !== "CONFIGURED" && status.state !== "VERIFIED") {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "PayPal is not configured; capture is unavailable." } },
      { status: 503 }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid capture request" } }, { status: 400 });
  }
  const { orderId, paypalOrderId } = parsed.data;
  const userId = await getSessionUserId();

  const order = await getOrder(userId, orderId);
  if (!order) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, { status: 404 });
  }
  if (order.providerReference && order.providerReference !== paypalOrderId) {
    return NextResponse.json(
      { error: { code: "MISMATCH", message: "PayPal order id does not match this order's reference." } },
      { status: 409 }
    );
  }
  if (order.state === "PAID") {
    return NextResponse.json({ alreadyCaptured: true, order });
  }
  if (!order.consentId || !order.consentHash) {
    return NextResponse.json(
      { error: { code: "CONSENT_REQUIRED", message: "This order is not bound to a consent artifact." } },
      { status: 409 }
    );
  }
  const consent = await getConsent(userId, order.consentId);
  if (!consent || consent.contentHash !== order.consentHash) {
    return NextResponse.json(
      { error: { code: "CONSENT_MISMATCH", message: "Order consent binding failed verification." } },
      { status: 409 }
    );
  }
  if (!["PENDING_APPROVAL", "APPROVED", "CAPTURING"].includes(order.state)) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: `Order is ${order.state}; capture is not allowed.` } },
      { status: 409 }
    );
  }

  try {
    const requestId = `cap_${sha256Hex(`${order.id}:${paypalOrderId}`).slice(0, 48)}`;
    const result = await capturePayPalOrder(paypalOrderId, requestId);

    // Walk the state machine explicitly; PENDING_APPROVAL -> PAID is invalid.
    let state: OrderState = order.state;
    if (state === "PENDING_APPROVAL") {
      await transitionOrder(userId, order.id, "APPROVED");
      state = "APPROVED";
    }
    if (state === "APPROVED") {
      await transitionOrder(userId, order.id, "CAPTURING");
      state = "CAPTURING";
    }
    const updated = await transitionOrder(userId, order.id, "PAID", {
      paymentProvider: "paypal",
      providerReference: paypalOrderId,
    });

    await recordPaymentAttempt({
      orderId: order.id,
      provider: "paypal",
      status: result.alreadyCaptured ? "COMPLETED" : result.status,
      amountMinor: order.totalMinor,
      currency: order.currency,
      providerReference: paypalOrderId,
    });
    const { createNotification } = await import("@/lib/db/notifications");
    await createNotification(
      userId,
      "PAYMENT_CAPTURED",
      "PayPal payment verified",
      `Order ${order.id} was captured and verified in the PayPal ${getPayPalStatus().label.includes("production") ? "live" : "sandbox"} environment.`
    ).catch(() => undefined);

    await appendLedgerEntry({
      type: "PAYMENT_CAPTURED",
      userId,
      subjectId: order.id,
      detail: {
        orderId: order.id,
        paypalOrderId,
        consentId: order.consentId,
        consentHash: order.consentHash,
        amountMinor: order.totalMinor,
        currency: order.currency,
        alreadyCaptured: result.alreadyCaptured,
      },
    }).catch(() => undefined);

    await recordAuditEvent("PAYMENT_CAPTURED", `PayPal sandbox capture verified for order ${order.id}`, {
      userId,
      metadata: {
        orderId: order.id,
        paypalOrderId,
        alreadyCaptured: result.alreadyCaptured,
        consentHash: order.consentHash,
      },
    });
    return NextResponse.json({ alreadyCaptured: result.alreadyCaptured, order: updated ?? order });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Capture failed";
    await recordPaymentAttempt({
      orderId: order.id,
      provider: "paypal",
      status: "FAILED",
      amountMinor: order.totalMinor,
      currency: order.currency,
      providerReference: paypalOrderId,
      failureMessage: message,
    }).catch(() => undefined);
    return NextResponse.json({ error: { code: "CAPTURE_FAILED", message } }, { status: 422 });
  }
}
