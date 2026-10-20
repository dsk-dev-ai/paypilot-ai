import { describe, test, expect, vi } from "vitest";
import { validateOrderItems } from "@/modules/orders/validation";
import { computeTotalFromItems } from "@/modules/payments/service";
import type { OrderItem } from "@/modules/orders/types";

describe("payments validation", () => {
  test("invalid order input rejected", () => {
    const errs = validateOrderItems([]);
    expect(errs.length).toBeGreaterThan(0);
  });

  test("server-side total calculation from catalog", () => {
    const items: OrderItem[] = [
      { productId: "p-004", quantity: 2, unitPrice: 24.5 },
    ];
    const total = computeTotalFromItems(items);
    expect(total).toBeCloseTo(49.0);
  });

  test("price mismatch with catalog rejected", () => {
    const items: OrderItem[] = [
      { productId: "p-004", quantity: 1, unitPrice: 999 },
    ];
    expect(() => computeTotalFromItems(items)).toThrow();
  });
});
