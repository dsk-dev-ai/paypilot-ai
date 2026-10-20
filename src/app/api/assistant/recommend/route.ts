import { NextRequest, NextResponse } from "next/server";
import { DEMO_CATALOG } from "@/modules/catalog/data";
import type { OrderItem } from "@/modules/orders/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || "").toString().toLowerCase();
    const budget = typeof body.budget === "number" ? body.budget : Number(body.budget) || 0;
    const picks: OrderItem[] = [];
    if (query.includes("headphone") || query.includes("music")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-001")!;
      picks.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (query.includes("coffee") || query.includes("drink")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-002")!;
      picks.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (query.includes("run") || query.includes("shoe")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-003")!;
      picks.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (query.includes("lamp") || query.includes("light")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-004")!;
      picks.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (query.includes("backpack") || query.includes("bag")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-005")!;
      picks.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (picks.length === 0) {
      const p1 = DEMO_CATALOG.find((x) => x.id === "p-004")!;
      const p2 = DEMO_CATALOG.find((x) => x.id === "p-005")!;
      picks.push({ productId: p1.id, quantity: 1, unitPrice: p1.price });
      picks.push({ productId: p2.id, quantity: 1, unitPrice: p2.price });
    }
    const total = picks.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
    const items = picks.map((i) => {
      const p = DEMO_CATALOG.find((x) => x.id === i.productId)!;
      return { ...i, name: p.name, description: p.description, category: p.category };
    });
    return NextResponse.json({ items, total, currency: "USD", budget, withinBudget: total <= budget + 1e-9, source: "deterministic-catalog" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
