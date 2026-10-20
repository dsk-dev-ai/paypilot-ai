import { NextResponse } from "next/server";
import { getAllInternalOrders } from "@/modules/orders/store";

export async function GET() {
  try {
    const orders = getAllInternalOrders().map((o) => ({
      id: o.id,
      ppOrderId: o.ppOrderId,
      items: o.items,
      total: o.total,
      currency: o.currency,
      state: o.state,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
    return NextResponse.json({ orders });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
