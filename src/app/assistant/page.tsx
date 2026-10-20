"use client";

import { useState } from "react";
import { DEMO_CATALOG } from "@/modules/catalog/data";
import { sumOrderItems } from "@/lib/calculations";
import { formatCurrency, isWithinBudget } from "@/lib/calculations";
import type { OrderItem } from "@/modules/orders/types";

export default function AssistantPage() {
  const [request, setRequest] = useState("");
  const [budget, setBudget] = useState<number>(200);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [explanation, setExplanation] = useState<string>("");

  function recommend() {
    // Deterministic simple recommendation based on keywords
    const req = request.toLowerCase();
    const picked: OrderItem[] = [];
    if (req.includes("headphone") || req.includes("music")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-001")!;
      picked.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (req.includes("coffee") || req.includes("drink")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-002")!;
      picked.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (req.includes("run") || req.includes("shoe")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-003")!;
      picked.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (req.includes("lamp") || req.includes("light")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-004")!;
      picked.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (req.includes("backpack") || req.includes("bag")) {
      const p = DEMO_CATALOG.find((x) => x.id === "p-005")!;
      picked.push({ productId: p.id, quantity: 1, unitPrice: p.price });
    }
    if (picked.length === 0) {
      // Default small bundle
      const p1 = DEMO_CATALOG.find((x) => x.id === "p-004")!;
      const p2 = DEMO_CATALOG.find((x) => x.id === "p-005")!;
      picked.push({ productId: p1.id, quantity: 1, unitPrice: p1.price });
      picked.push({ productId: p2.id, quantity: 1, unitPrice: p2.price });
    }
    setItems(picked);
    const total = sumOrderItems(picked);
    setExplanation(
      `Recommendations based on actual catalog prices. Total ${formatCurrency(total)}. Budget ${formatCurrency(
        budget
      )}: ${isWithinBudget(total, budget) ? "within budget" : "over budget"}.`
    );
  }

  const total = sumOrderItems(items);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Shopping Assistant</h2>
      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <div>
          <label className="block text-sm font-medium">Request</label>
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g., headphones and coffee for work"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Budget (USD)</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={recommend}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Get Recommendations
        </button>
      </div>
      {items.length > 0 && (
        <div className="rounded-lg border bg-white p-4 shadow-sm space-y-2">
          <h3 className="font-medium">Recommended Order</h3>
          <ul className="space-y-1 text-sm">
            {items.map((it, idx) => {
              const p = DEMO_CATALOG.find((x) => x.id === it.productId);
              return (
                <li key={idx}>
                  {p?.name} x{it.quantity} @ {formatCurrency(it.unitPrice)}
                </li>
              );
            })}
          </ul>
          <div className="text-sm font-medium">Total: {formatCurrency(total)}</div>
          <p className="text-sm text-gray-600">{explanation}</p>
          <p className="text-xs text-gray-500">Order state: draft (not submitted). PayPal flow not implemented.</p>
        </div>
      )}
    </div>
  );
}
