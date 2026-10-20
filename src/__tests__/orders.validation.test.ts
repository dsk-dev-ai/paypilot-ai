import { validateOrderItems, canTransition } from "@/modules/orders/validation";
import type { OrderItem } from "@/modules/orders/types";

describe("order validation", () => {
  test("rejects empty items", () => {
    const errs = validateOrderItems([]);
    expect(errs.length).toBeGreaterThan(0);
  });

  test("accepts valid items", () => {
    const items: OrderItem[] = [{ productId: "p1", quantity: 1, unitPrice: 10 }];
    const errs = validateOrderItems(items);
    expect(errs.length).toBe(0);
  });

  test("rejects invalid quantity", () => {
    const items: OrderItem[] = [{ productId: "p1", quantity: 0, unitPrice: 10 }];
    const errs = validateOrderItems(items);
    expect(errs.some((e) => e.toLowerCase().includes("quantity"))).toBe(true);
  });

  test("transitions", () => {
    expect(canTransition("draft", "pending_approval")).toBe(true);
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("paid", "refunded")).toBe(true);
  });
});
