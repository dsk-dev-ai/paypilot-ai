import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getOrder, listPaymentAttempts } from "@/lib/db/orders";
import { listHandoffsForOrder } from "@/lib/db/handoffs";
import { getFulfillment } from "@/lib/db/fulfillments";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const order = await getOrder(userId, id);
  if (!order) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, { status: 404 });
  }
  const [paymentAttempts, handoffs, fulfillment] = await Promise.all([
    listPaymentAttempts(order.id),
    listHandoffsForOrder(userId, order.id),
    getFulfillment(userId, order.id),
  ]);
  return NextResponse.json({ order, paymentAttempts, handoffs, fulfillment });
}
