"use client";

import { use, useEffect, useState } from "react";
import type { ProductListing } from "@/lib/core/listing";
import { formatMinor, formatAge } from "@/lib/money-format";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";

type DetailResponse =
  | { listing: ProductListing; freshness: "live" | "snapshot"; stale?: boolean; providerStatus: { state: string; message: string } }
  | { error: { code: string; message: string }; providerStatus?: { state: string; message: string } };

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ provider: string; externalId: string }>;
}) {
  const { provider, externalId } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = new URLSearchParams(window.location.search).get("region") ?? "IN";
    fetch(`/api/products/${provider}/${externalId}?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: { code: "NETWORK", message: "Failed to load product" } }))
      .finally(() => setLoading(false));
  }, [provider, externalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading product…
      </div>
    );
  }

  if (!data || "error" in data) {
    return (
      <ErrorState
        title="Product unavailable"
        body={data && "error" in data ? data.error.message : "No data for this product."}
      />
    );
  }

  const l = data.listing;
  const attrs = Object.entries(l.attributes).slice(0, 24);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="text-xs text-faint">
        <a href="/search" className="hover:text-muted">
          ← Back to search
        </a>
      </div>
      <SectionTitle
        title={l.title}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{l.provider}</Badge>
            <Badge tone={l.availability === "IN_STOCK" ? "success" : l.availability === "OUT_OF_STOCK" ? "danger" : "warn"}>
              {l.availability.replace("_", " ")}
            </Badge>
            {data.freshness === "snapshot" ? (
              <Badge tone={data.stale ? "warn" : "neutral"}>
                Cached snapshot · {data.stale ? "stale" : "recent"}
              </Badge>
            ) : (
              <Badge tone="success">Live data</Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex items-center justify-center p-8">
          {l.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.imageUrl} alt={l.title} className="max-h-80 object-contain" />
          ) : (
            <div className="text-6xl text-faint">▢</div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">
                {formatMinor(l.price.amountMinor, l.price.currency)}
              </span>
              {l.originalPrice && l.originalPrice.amountMinor > l.price.amountMinor ? (
                <span className="text-sm text-faint line-through">
                  {formatMinor(l.originalPrice.amountMinor, l.price.currency)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-faint">
              Price from {l.provider} · updated {formatAge(l.fetchedAt)} · region {l.region}
            </p>
            {l.attribution ? <p className="text-xs text-muted italic">{l.attribution}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={l.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-medium text-white"
              >
                Buy at {l.provider} ↗
              </a>
              <ButtonLink href="/search" variant="ghost">
                Back to search
              </ButtonLink>
            </div>
            <p className="text-[11px] text-faint">
              Checkout is completed on {l.provider}&apos;s official site. Mandate does not add items
              to external carts.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {l.brand ? <Row k="Brand" v={l.brand} /> : null}
              {l.seller ? <Row k="Seller" v={l.seller} /> : null}
              {l.category ? <Row k="Category" v={l.category} /> : null}
              {l.rating ? <Row k="Rating" v={`★ ${l.rating.value.toFixed(1)} (${l.rating.count} ratings)`} /> : null}
              <Row k="Listing ID" v={l.id} />
              {attrs.map(([k, v]) => (
                <Row key={k} k={k} v={String(v)} />
              ))}
            </dl>
            {attrs.length === 0 && !l.brand && !l.seller && !l.category && !l.rating ? (
              <p className="text-xs text-faint">No additional attributes provided by the source.</p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5">
      <dt className="text-faint capitalize">{k}</dt>
      <dd className="text-right text-text break-all">{v}</dd>
    </div>
  );
}
