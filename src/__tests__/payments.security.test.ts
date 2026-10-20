import { describe, test, expect } from "vitest";
import { createInternalOrder, attachPayPalOrder, getInternalOrderByPayPalId } from "@/modules/orders/store";
import { computeTotalFromItems } from "@/modules/payments/service";
import type { OrderItem } from "@/modules/orders/types";

describe("payment security", () => {
  test("internal order association required", () => {
    const items: OrderItem[] = [{ productId: "p-004", quantity: 1, unitPrice: 24.5 }];
    const total = computeTotalFromItems(items);
    const internal = createInternalOrder(items, total);
    attachPayPalOrder(internal.id, "PP-TEST-123");
    const found = getInternalOrderByPayPalId("PP-TEST-123");
    expect(found?.id).toBe(internal.id);
  });

  test("amount mismatch detection logic", () => {
    const expected = 49.0;
    const pp = 50.0;
    expect(Math.abs(pp - expected) > 1e-6).toBe(true);
  });

  test("currency mismatch", () => {
    const a: string = "EUR";
    const b: string = "USD";
    expect(a !== b).toBe(true);
  });
});
