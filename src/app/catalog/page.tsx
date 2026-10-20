"use client";

import { useEffect, useState } from "react";
import { DEMO_CATALOG } from "@/modules/catalog/data";
import { formatCurrency } from "@/lib/calculations";
import Link from "next/link";

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const cats = ["all", ...Array.from(new Set(DEMO_CATALOG.map(p=>p.category)))];
  const items = DEMO_CATALOG.filter(p => (cat==="all"||p.category===cat) && (q==="" || p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">Product Catalog</h2>
        <p className="text-sm text-[#9aa3c0]">Trusted prices in USD. Server-validated at checkout.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products..." className="flex-1 rounded-lg border border-[#20284a] bg-[#121a33]/60 px-3 py-2 text-sm text-white placeholder:text-[#6b749f]" />
        <select value={cat} onChange={e=>setCat(e.target.value)} className="rounded-lg border border-[#20284a] bg-[#121a33]/60 px-3 py-2 text-sm text-white">
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p, idx)=>(
          <article key={p.id} className="group rounded-xl border border-[#20284a] bg-[#121a33]/60 overflow-hidden shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_40px_120px_-40px_rgba(79,155,255,0.35)] animate-fade-up" style={{animationDelay:`${idx*60}ms`}}>
            <div className="h-28 bg-gradient-to-br from-[#4f9bff]/20 to-[#7c3fff]/20" />
            <div className="p-4">
              <h3 className="font-medium text-white">{p.name}</h3>
              <p className="mt-1 text-sm text-[#9aa3c0] line-clamp-2">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-base font-medium text-white">{formatCurrency(p.price)}</span>
                <span className="text-xs text-[#9aa3c0]">{p.category}</span>
              </div>
              <Link href="/checkout" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#4f9bff] to-[#7c3fff] px-3 py-2 text-sm text-white">Buy Now</Link>
            </div>
          </article>
        ))}
      </div>
      {items.length===0 && <div className="text-center text-sm text-[#9aa3c0]">No products match your filters.</div>}
    </div>
  );
}
