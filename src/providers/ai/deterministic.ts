import { DEMO_CATALOG } from "@/modules/catalog/data";
import type { AIPlanRequest, AIPlanResponse } from "./types";

export class DeterministicProvider {
  name = "deterministic" as const;
  isConfigured() { return true; }
  async plan(req: AIPlanRequest): Promise<AIPlanResponse> {
    const q = req.query.toLowerCase();
    const items = [];
    if (q.includes("headphone") || q.includes("music")) { const p = DEMO_CATALOG.find(x=>x.id==="p-001")!; items.push({productId:p.id,quantity:1,unitPrice:p.price}); }
    if (q.includes("coffee") || q.includes("drink")) { const p = DEMO_CATALOG.find(x=>x.id==="p-002")!; items.push({productId:p.id,quantity:1,unitPrice:p.price}); }
    if (q.includes("run") || q.includes("shoe")) { const p = DEMO_CATALOG.find(x=>x.id==="p-003")!; items.push({productId:p.id,quantity:1,unitPrice:p.price}); }
    if (q.includes("lamp") || q.includes("light")) { const p = DEMO_CATALOG.find(x=>x.id==="p-004")!; items.push({productId:p.id,quantity:1,unitPrice:p.price}); }
    if (q.includes("backpack") || q.includes("bag")) { const p = DEMO_CATALOG.find(x=>x.id==="p-005")!; items.push({productId:p.id,quantity:1,unitPrice:p.price}); }
    if (items.length===0) { const p1=DEMO_CATALOG.find(x=>x.id==="p-004")!; const p2=DEMO_CATALOG.find(x=>x.id==="p-005")!; items.push({productId:p1.id,quantity:1,unitPrice:p1.price}); items.push({productId:p2.id,quantity:1,unitPrice:p2.price}); }
    return { items, rationale: "Grounded in trusted catalog using deterministic matching.", source: "deterministic" };
  }
}
