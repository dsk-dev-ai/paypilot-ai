import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder, getPayPalOrder } from "@/modules/payments/client";
import { getInternalOrderByPayPalId, updateInternalOrder } from "@/modules/orders/store";

function parseAmount(v?: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = body.orderId as string;
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    const internal = getInternalOrderByPayPalId(orderId);
    if (!internal) {
      return NextResponse.json({ error: "Order not associated with internal order" }, { status: 403 });
    }
    // Check current status first
    const order = await getPayPalOrder(orderId);
    // Verify amount/currency if present
    const pu = order.purchase_units?.[0];
    const ppAmount = parseAmount(pu?.amount?.value);
    const ppCurrency = pu?.amount?.currency_code || "USD";
    if (ppAmount !== null && Math.abs(ppAmount - internal.total) > 1e-6) {
      updateInternalOrder(internal.id, { state: "failed" });
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }
    if (ppCurrency !== internal.currency) {
      updateInternalOrder(internal.id, { state: "failed" });
      return NextResponse.json({ error: "Currency mismatch" }, { status: 400 });
    }
    if (order.status === "COMPLETED") {
      updateInternalOrder(internal.id, { state: "completed" });
      return NextResponse.json({ status: "COMPLETED", alreadyCaptured: true });
    }
    if (order.status !== "APPROVED") {
      updateInternalOrder(internal.id, { state: order.status === "CANCELLED" ? "canceled" : "failed" });
      return NextResponse.json({ error: `Cannot capture order in status ${order.status}` }, { status: 400 });
    }
    updateInternalOrder(internal.id, { state: "capturing" });
    try {
      const result = await capturePayPalOrder(orderId);
      updateInternalOrder(internal.id, { state: "completed" });
      return NextResponse.json({ status: "CAPTURED", result });
    } catch (e: unknown) {
      updateInternalOrder(internal.id, { state: "failed" });
      const msg = e instanceof Error ? e.message : "Capture failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Capture failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
