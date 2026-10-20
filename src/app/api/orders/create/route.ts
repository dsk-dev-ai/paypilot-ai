import { NextRequest, NextResponse } from "next/server";
import { validateOrderItems } from "@/modules/orders/validation";
import { computeTotalFromItems, formatAmount } from "@/modules/payments/service";
import { createPayPalOrder } from "@/modules/payments/client";
import { createInternalOrder, attachPayPalOrder } from "@/modules/orders/store";
import type { OrderItem } from "@/modules/orders/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = body.items as OrderItem[];
    const errors = validateOrderItems(items);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }
    const total = computeTotalFromItems(items);
    const internal = createInternalOrder(
      items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      total
    );
    const ppOrder = await createPayPalOrder({ amount: formatAmount(total), currency_code: "USD" });
    attachPayPalOrder(internal.id, ppOrder.id);
    const approveLink = ppOrder.links?.find((l) => l.rel === "approve")?.href;
    return NextResponse.json({
      internalOrderId: internal.id,
      orderId: ppOrder.id,
      status: ppOrder.status,
      approveUrl: approveLink,
      total,
      currency: "USD",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
