"use client";

import { useState } from "react";
import { DEMO_CATALOG } from "@/modules/catalog/data";
import { sumOrderItems, formatCurrency } from "@/lib/calculations";
import type { OrderItem } from "@/modules/orders/types";

export default function CheckoutPage() {
  const [items] = useState<OrderItem[]>([
    { productId: "p-004", quantity: 1, unitPrice: 24.5 },
    { productId: "p-005", quantity: 1, unitPrice: 59.25 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = sumOrderItems(items);

  async function startCheckout() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/orders/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.approveUrl) window.location.href = data.approveUrl;
      else throw new Error("No approval URL");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">Checkout</h2>
        <p className="text-sm text-[#9aa3c0]">PayPal Sandbox · Buyer approval required · USD</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur space-y-3">
          <h3 className="font-medium text-white">Order Summary</h3>
          <ul className="divide-y divide-[#20284a]">
            {items.map((it, idx) => {
              const p = DEMO_CATALOG.find(x=>x.id===it.productId);
              return <li key={idx} className="flex items-center justify-between py-2"><div><div className="text-sm text-white">{p?.name}</div><div className="text-xs text-[#9aa3c0]">Qty {it.quantity}</div></div><div className="text-sm text-white">{formatCurrency(it.unitPrice*it.quantity)}</div></li>;
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-[#20284a] pt-2 text-sm"><span className="text-[#9aa3c0]">Total</span><span className="text-white">{formatCurrency(total)}</span></div>
        </div>
        <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur space-y-3">
          <h3 className="font-medium text-white">Payment</h3>
          <p className="text-sm text-[#9aa3c0]">You will be redirected to PayPal Sandbox for approval. Payment is captured only after approval and server verification.</p>
          <button onClick={startCheckout} disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-4 py-2.5 text-sm text-white disabled:opacity-50">{loading ? "Creating order..." : "Continue to PayPal (Sandbox)"}</button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
