import { sumOrderItems, isWithinBudget } from "@/lib/calculations";
import type { OrderItem } from "@/modules/orders/types";

describe("calculations", () => {
  test("sumOrderItems calculates total", () => {
    const items: OrderItem[] = [
      { productId: "p1", quantity: 2, unitPrice: 10 },
      { productId: "p2", quantity: 1, unitPrice: 5.5 },
    ];
    expect(sumOrderItems(items)).toBeCloseTo(25.5);
  });

  test("isWithinBudget allows exact and under", () => {
    expect(isWithinBudget(100, 100)).toBe(true);
    expect(isWithinBudget(99.99, 100)).toBe(true);
  });

  test("isWithinBudget rejects over", () => {
    expect(isWithinBudget(100.01, 100)).toBe(false);
  });
});
