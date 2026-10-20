import { sumOrderItems } from "@/lib/calculations";
import { DEMO_CATALOG } from "@/modules/catalog/data";
import { OrderItem } from "@/modules/orders/types";

export function computeTotalFromItems(items: OrderItem[]): number {
  // Validate against catalog
  for (const it of items) {
    const p = DEMO_CATALOG.find((x) => x.id === it.productId);
    if (!p) throw new Error("Unknown product");
    if (Math.abs(p.price - it.unitPrice) > 1e-9) {
      throw new Error("Price mismatch with catalog");
    }
  }
  return sumOrderItems(items);
}

export function formatAmount(amount: number): string {
  // Ensure 2 decimal places for USD
  return amount.toFixed(2);
}
