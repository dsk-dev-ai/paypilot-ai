"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import Link from "next/link";

type RecItem = { productId: string; quantity: number; unitPrice: number; name: string; description: string; category: string };

export default function AssistantPage() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState<number>(200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ items: RecItem[]; total: number; currency: string; withinBudget: boolean; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function recommend() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/assistant/recommend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, budget }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">AI Shopping Assistant</h2>
        <p className="text-sm text-[#9aa3c0]">Grounded in the trusted catalog. Deterministic fallback by design.</p>
      </div>
      <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur space-y-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-white">What are you looking for?</label>
          <input id="q" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g., headphones and coffee for work" className="mt-1 w-full rounded-lg border border-[#20284a] bg-[#0f152b] px-3 py-2 text-sm text-white placeholder:text-[#6b749f]" />
        </div>
        <div>
          <label htmlFor="b" className="block text-sm font-medium text-white">Budget (USD)</label>
          <input id="b" type="number" value={budget} onChange={e=>setBudget(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#20284a] bg-[#0f152b] px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={recommend} disabled={loading} className="rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-5 py-2.5 text-sm text-white disabled:opacity-50">{loading ? "Thinking..." : "Get Recommendations"}</button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      {result && (
        <div className="rounded-xl border border-[#20284a] bg-[#121a33]/60 p-6 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Recommendations</h3>
            <span className="text-xs text-[#9aa3c0]">{result.source}</span>
          </div>
          <ul className="space-y-2">
            {result.items.map((i, idx)=>(<li key={idx} className="flex items-center justify-between rounded-lg border border-[#20284a] bg-[#0f152b]/60 p-3"><div><div className="text-sm font-medium text-white">{i.name}</div><div className="text-xs text-[#9aa3c0]">{i.description}</div></div><div className="text-sm text-white">{formatCurrency(i.unitPrice)}</div></li>))}
          </ul>
          <div className="text-sm text-white">Total: {formatCurrency(result.total)} {result.withinBudget ? "(within budget)" : "(over budget)"}</div>
          <Link href="/checkout" className="inline-flex rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-4 py-2 text-sm text-white">Proceed to Checkout</Link>
        </div>
      )}
    </div>
  );
}
