"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { formatAge, formatMinor } from "@/lib/money-format";

type WishlistItem = {
  id: string;
  listingId: string;
  provider: string;
  title: string;
  priceMinor: number;
  currency: string;
  availability: string;
  addedAt: string;
  fetchedAt: string;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error.message);
        setItems(data.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load wishlist");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = async (id: string) => {
    setNotice(null);
    const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setNotice("Removed from wishlist.");
    } else {
      const data = await res.json();
      setError(data?.error?.message ?? "Could not remove");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading wishlist…
      </div>
    );
  }
  if (error) return <ErrorState body={error} onRetry={() => setError(null)} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Wishlist"
        subtitle="Saved listings from real provider snapshots. Prices shown are as-of the last search — always re-check at the retailer."
      />
      {notice ? <Card className="p-3 text-sm text-muted">{notice}</Card> : null}
      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Save listings from search results to watch them here. Saving requires a verified snapshot — you cannot save invented products."
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{it.provider}</Badge>
                  <Badge tone={it.availability === "IN_STOCK" ? "success" : "warn"}>
                    {it.availability.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{it.title}</p>
                <p className="text-xs text-faint">
                  saved {formatAge(it.addedAt)} · price data {formatAge(it.fetchedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatMinor(it.priceMinor, it.currency)}</span>
                <button
                  onClick={() => void remove(it.id)}
                  className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
