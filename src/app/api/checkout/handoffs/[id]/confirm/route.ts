import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { confirmHandoff, getHandoff } from "@/lib/db/handoffs";
import { getOrder, transitionOrder } from "@/lib/db/orders";
import { recordAuditEvent } from "@/lib/db/audit";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/handoffs/[id]/confirm — the user states they completed
 * the purchase on the merchant's site. This is SELF-REPORTED: Mandate has
 * no way to verify merchant-side purchases and never claims it did.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const handoff = await getHandoff(userId, id);
  if (!handoff) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Handoff not found" } }, { status: 404 });
  }
  const confirmed = await confirmHandoff(userId, id);
  if (handoff.orderId) {
    const order = await getOrder(userId, handoff.orderId);
    if (order && order.state === "CREATED") {
      await transitionOrder(userId, order.id, "PENDING_APPROVAL").catch(() => undefined);
    }
  }
  const { createNotification } = await import("@/lib/db/notifications");
  await createNotification(
    userId,
    "HANDOFF_CONFIRMED",
    `Checkout at ${handoff.provider} marked complete`,
    "Recorded as self-reported — Mandate cannot verify retailer-side purchases."
  ).catch(() => undefined);
  await recordAuditEvent("HANDOFF_CONFIRMED", `User confirmed completing checkout at ${handoff.provider} (self-reported)`, {
    userId,
    metadata: { handoffId: id, provider: handoff.provider, orderId: handoff.orderId, selfReported: true },
  });
  return NextResponse.json({ handoff: confirmed, selfReported: true });
}
