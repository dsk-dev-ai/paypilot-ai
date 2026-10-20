import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/providers/ai";
import { DEMO_CATALOG } from "@/modules/catalog/data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || "").toString();
    const budget = typeof body.budget === "number" ? body.budget : Number(body.budget) || 0;
    const provider = getAIProvider();
    const plan = await provider.plan({ query, budget, currency: "USD" }, DEMO_CATALOG.map(p=>({id:p.id,name:p.name,price:p.price})));
    const items = plan.items.map(i=>{
      const p = DEMO_CATALOG.find(x=>x.id===i.productId)!;
      return { ...i, name: p.name, description: p.description, category: p.category };
    });
    const total = items.reduce((a,i)=>a+i.unitPrice*i.quantity,0);
    return NextResponse.json({ items, total, currency: "USD", withinBudget: total <= budget + 1e-9, source: provider.name });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
