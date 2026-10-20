import { DEMO_CATALOG } from "@/modules/catalog/data";

export function validatePlanItems(items: Array<{productId:string;quantity:number;unitPrice:number}>) {
  const errors: string[] = [];
  if (!Array.isArray(items) || items.length===0) { errors.push("No items"); return errors; }
  for (const it of items) {
    const p = DEMO_CATALOG.find(x=>x.id===it.productId);
    if (!p) { errors.push("Unknown product"); continue; }
    if (Math.abs(p.price - it.unitPrice) > 1e-9) errors.push("Price mismatch");
    if (!Number.isInteger(it.quantity) || it.quantity<=0) errors.push("Invalid quantity");
  }
  return errors;
}
