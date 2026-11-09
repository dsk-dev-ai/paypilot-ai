"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { formatMinor } from "@/lib/money-format";
import type { CatalogProduct } from "@/lib/catalog/products";

export function StoreGrid({ products }: { products: CatalogProduct[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addToPlan = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/plan/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "paypilot", externalId: id, region: "US", quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not add to plan");
      setAddedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to plan");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {error ? (
        <Card className="border-danger/30 bg-danger/5 p-3.5 text-sm text-danger">{error}</Card>
      ) : null}
      {addedId ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-success/30 bg-success/5 p-3.5 text-sm text-success">
          <span>Added to your draft plan. Approve it to issue the consent hash.</span>
          <div className="flex gap-2">
            <ButtonLink href="/plan" size="sm">
              Review plan
            </ButtonLink>
            <ButtonLink href="/agent" size="sm" variant="secondary">
              Or ask the agent
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p.id} className="group flex h-full flex-col overflow-hidden" interactive>
            <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${p.gradient}`}>
              <span className="text-5xl transition-transform duration-300 group-hover:scale-110">{p.emoji}</span>
              {p.originalPriceMinor ? (
                <span className="absolute right-3 top-3 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  SAVE {Math.round((1 - p.priceMinor / p.originalPriceMinor) * 100)}%
                </span>
              ) : null}
              <span className="absolute bottom-3 left-3 rounded-full border border-line bg-bg/60 px-2 py-0.5 text-[10px] text-muted backdrop-blur">
                {p.deliverable.label}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge tone="neutral">{p.category}</Badge>
                  <h3 className="mt-2 text-sm font-semibold text-text">{p.title}</h3>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold">{formatMinor(p.priceMinor, "USD")}</div>
                  {p.originalPriceMinor ? (
                    <div className="text-[11px] text-faint line-through">
                      {formatMinor(p.originalPriceMinor, "USD")}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted">{p.tagline}</p>
              <ul className="space-y-1 text-[11px] text-faint">
                {p.highlights.slice(0, 2).map((h) => (
                  <li key={h} className="flex items-center gap-1.5">
                    <span className="text-success">✓</span> {h}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-faint">
                  ★ {p.rating.value.toFixed(1)} · {p.rating.count.toLocaleString()} sold
                </span>
                <Button size="sm" disabled={busyId === p.id} onClick={() => void addToPlan(p.id)}>
                  {busyId === p.id ? "Adding…" : addedId === p.id ? "Added ✓" : "Add to plan"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
