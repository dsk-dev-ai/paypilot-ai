import { OrderItem } from "@/modules/orders/types";

export function sumOrderItems(items: OrderItem[]): number {
  return items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
}

export function formatCurrency(amount: number, currency: "USD" = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function isWithinBudget(total: number, budget: number): boolean {
  if (budget < 0) return false;
  return total <= budget + 1e-9;
}
