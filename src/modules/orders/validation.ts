import { OrderItem, OrderState } from "../orders/types";

const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  draft: ["pending_approval", "canceled"],
  pending_approval: ["approved", "canceled", "failed"],
  approved: ["capturing", "canceled", "failed"],
  capturing: ["paid", "failed"],
  paid: ["refunded"],
  failed: ["draft", "canceled"],
  canceled: [],
  refunded: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateOrderItems(items: OrderItem[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Order must contain at least one item");
    return errors;
  }
  for (const it of items) {
    if (!it.productId || typeof it.productId !== "string") {
      errors.push("Invalid productId");
    }
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      errors.push("Quantity must be a positive integer.");
    }
    if (typeof it.unitPrice !== "number" || it.unitPrice < 0) {
      errors.push("unitPrice must be a non-negative number");
    }
  }
  return errors;
}
