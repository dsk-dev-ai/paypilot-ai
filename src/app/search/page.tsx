"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductListing } from "@/lib/core/listing";
import type { SearchSort } from "@/lib/core/provider";
import { ProductCard } from "@/components/ProductCard";
import { StaggerGroup, StaggerItem, MotionCard } from "@/components/motion/Reveal";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Badge, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";

type ProviderSearchInfo = { id: string; label: string; state: string };

type Outcome =
  | { provider: string; ok: true; count: number; ms: number; cached: boolean }
  | { provider: string; ok: false; code: string; message: string; ms: number };

type SearchResponse = {
  listings: ProductListing[];
  outcomes: Outcome[];
  partial: boolean;
  stale: boolean;
  totalBeforeLimit: number;
  searchedAt: string;
  officialLinks?: Array<{ provider: string; label: string; url: string; reason: string }>;
};

const REGION_CURRENCY: Record<string, string> = { IN: "INR", US: "USD", UK: "GBP", EU: "EUR" };

function toMinor(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("IN");
  const [sort, setSort] = useState<SearchSort>("relevance");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderSearchInfo[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [planListingIds, setPlanListingIds] = useState<string[]>([]);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => r.json())
      .then((data) => {
        const items: Array<{ listingId: string }> = data.plan?.items ?? [];
        setPlanListingIds(items.map((i) => i.listingId));
      })
      .catch(() => setPlanListingIds([]));
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((data) => {
        const items: Array<{ listingId: string }> = data.items ?? [];
        setWishlistIds(items.map((i) => i.listingId));
      })
      .catch(() => setWishlistIds([]));
  }, []);

  const saveToWishlist = async (listing: ProductListing) => {
    setPlanNotice(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: listing.provider, externalId: listing.externalId, region: listing.region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not save");
      setWishlistIds((prev) => (prev.includes(listing.id) ? prev : [...prev, listing.id]));
      setPlanNotice("Saved to wishlist.");
    } catch (e) {
      setPlanNotice(e instanceof Error ? e.message : "Could not save");
    }
  };

  const addToPlan = async (listing: ProductListing) => {
    setAdding(listing.id);
    setPlanNotice(null);
    try {
      const res = await fetch("/api/plan/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: listing.provider,
          externalId: listing.externalId,
          region: listing.region,
          quantity: 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not add to plan");
      setPlanListingIds((prev) => (prev.includes(listing.id) ? prev : [...prev, listing.id]));
      setPlanNotice("Added to your plan.");
    } catch (e) {
      setPlanNotice(e instanceof Error ? e.message : "Could not add to plan");
    } finally {
      setAdding(null);
    }
  };

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data: { search?: ProviderSearchInfo[] }) => setProviders(data.search ?? []))
      .catch(() => setProviders([]));
  }, []);

  const runSearch = useCallback(async () => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCompare([]);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: q.trim(),
          region,
          currency: REGION_CURRENCY[region] ?? "INR",
          sort,
          minPriceMinor: toMinor(minPrice),
          maxPriceMinor: toMinor(maxPrice),
          providers: providerFilter,
          limit: 24,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Search failed (HTTP ${res.status})`);
      }
      setResult(data as SearchResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [q, region, sort, minPrice, maxPrice, providerFilter]);

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]
    );
  };

  const goCompare = () => {
    router.push(`/compare?ids=${encodeURIComponent(compare.join(","))}&region=${region}`);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Search"
        subtitle="One query, every authorized provider. Results are live API data where configured — clearly labeled otherwise."
      />

      <Card className="p-4 sm:p-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. wireless noise cancelling headphones under 20000"
              aria-label="Search query"
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !q.trim()}>
              {loading ? <Spinner /> : null}
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
              <option value="IN">India</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="EU">Europe</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SearchSort)} aria-label="Sort">
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating">Rating</option>
              <option value="newest">Newest data</option>
            </Select>
            <Input
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min price"
              inputMode="decimal"
              aria-label="Minimum price"
            />
            <Input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max price"
              inputMode="decimal"
              aria-label="Maximum price"
            />
          </div>
          {providers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-faint">Providers:</span>
              {providers.map((p) => {
                const active = providerFilter.includes(p.id);
                const disabled = p.state === "NOT_CONFIGURED";
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setProviderFilter((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-accent bg-accent/15 text-accent"
                        : disabled
                          ? "border-line text-faint cursor-not-allowed"
                          : "border-line text-muted hover:border-line-strong"
                    }`}
                    title={disabled ? `${p.label} is not configured` : p.label}
                  >
                    {p.label}
                    {disabled ? " · off" : ""}
                  </button>
                );
              })}
              <span className="text-[11px] text-faint">(none = all configured)</span>
            </div>
          ) : null}
        </form>
      </Card>

      {compare.length >= 2 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/30 p-3.5">
          <p className="text-sm text-muted">
            {compare.length} selected for comparison{" "}
            <span className="text-faint">(max 4)</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={goCompare}>
              Compare side by side
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
              Clear
            </Button>
          </div>
        </Card>
      ) : null}

      {planNotice ? (
        <Card className="flex items-center justify-between gap-3 border-accent/30 p-3.5 text-sm">
          <span className={planNotice === "Added to your plan." ? "text-success" : "text-danger"}>{planNotice}</span>
          <ButtonLink href="/plan" size="sm" variant="secondary">
            View plan
          </ButtonLink>
        </Card>
      ) : null}

      {error ? <ErrorState body={error} onRetry={() => void runSearch()} /> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="skeleton aspect-[4/3]" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-5 w-1/3 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && result ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={result.partial ? "warn" : "neutral"}>
              {result.partial ? "Partial results — some providers failed" : "All requested providers responded"}
            </Badge>
            {result.stale ? <Badge tone="danger">No live data available</Badge> : null}
            <span className="text-faint">
              {result.listings.length} shown · searched {new Date(result.searchedAt).toLocaleTimeString()}
            </span>
            {result.outcomes.map((o) =>
              o.ok ? (
                <Badge key={o.provider} tone="success">
                  {o.provider}: {o.count} {o.cached ? "(cached)" : ""}
                </Badge>
              ) : (
                <Badge key={o.provider} tone={o.code === "NOT_CONFIGURED" || o.code === "ACCESS_PENDING" ? "neutral" : "warn"}>
                  {o.provider}: {o.code}
                </Badge>
              )
            )}
          </div>

          {result.officialLinks && result.officialLinks.length > 0 ? (
            <Card className="p-4">
              <p className="text-xs font-medium text-muted mb-2">Not connected — search officially instead:</p>
              <div className="flex flex-wrap gap-2">
                {result.officialLinks.map((l) => (
                  <a
                    key={l.provider}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent transition-colors"
                    title={l.reason}
                  >
                    {l.label} search ↗
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          {result.listings.length === 0 ? (
            <EmptyState
              title="No listings found"
              body="No provider returned results for this query. Try different keywords, or connect a provider in Status."
              action={<ButtonLink href="/status" variant="secondary">Integration status</ButtonLink>}
            />
          ) : (
            <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.listings.map((l) => (
                <StaggerItem key={l.id}>
                  <MotionCard className="h-full">
                    <ProductCard
                      listing={l}
                      selected={compare.includes(l.id)}
                      onToggleCompare={toggleCompare}
                      compareDisabled={compare.length >= 4}
                      onAddToPlan={() => void addToPlan(l)}
                      addedToPlan={planListingIds.includes(l.id) || adding === l.id}
                      onSave={() => void saveToWishlist(l)}
                      saved={wishlistIds.includes(l.id)}
                    />
                  </MotionCard>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}

          {result.totalBeforeLimit > result.listings.length ? (
            <p className="text-center text-xs text-faint">
              Showing {result.listings.length} of {result.totalBeforeLimit} results — refine filters or
              paging for more.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && !result ? (
        <EmptyState
          title="Search across your connected stores"
          body="eBay and Flipkart appear here once their API credentials are configured. Unconnected stores still offer official search links after you search."
        />
      ) : null}
    </div>
  );
}
