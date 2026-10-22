"use client";

import { Suspense, useEffect, useState } from "react";
import type { ProductListing } from "@/lib/core/listing";
import { formatMinor, formatAge } from "@/lib/money-format";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui/Card";
import { useSearchParams } from "next/navigation";

type Loaded =
  | { ok: true; listing: ProductListing; freshness: string }
  | { ok: false; id: string; message: string };

function CompareInner() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean);
  const [items, setItems] = useState<Loaded[] | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    Promise.all(
      ids.map(async (id): Promise<Loaded> => {
        const [provider, ...rest] = id.split(":");
        const externalId = rest.join(":");
        const region = new URLSearchParams(window.location.search).get("region") ?? "IN";
        try {
          const res = await fetch(
            `/api/products/${encodeURIComponent(provider)}/${encodeURIComponent(externalId)}?region=${encodeURIComponent(region)}`
          );
          const data = await res.json();
          if (!res.ok || data.error) {
            return { ok: false, id, message: data?.error?.message ?? "Unavailable" };
          }
          return { ok: true, listing: data.listing, freshness: data.freshness };
        } catch {
          return { ok: false, id, message: "Network error" };
        }
      })
    ).then(setItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  if (items === null) {
    if (ids.length < 2) {
      return (
        <EmptyState
          title="Nothing to compare"
          body="Select 2–4 products on the search results page using the Compare checkbox, then open the comparison view."
          action={<ButtonLink href="/search">Go to search</ButtonLink>}
        />
      );
    }
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading comparison…
      </div>
    );
  }

  if (items.length < 2) {
    return (
      <EmptyState
        title="Nothing to compare"
        body="Select 2–4 products on the search results page using the Compare checkbox, then open the comparison view."
        action={<ButtonLink href="/search">Go to search</ButtonLink>}
      />
    );
  }

  const okItems = items.filter((x): x is Extract<Loaded, { ok: true }> => x.ok);
  const failed = items.filter((x): x is Extract<Loaded, { ok: false }> => !x.ok);
  const cheapest = okItems.length
    ? okItems.reduce((best, it) => (it.listing.price.amountMinor < best.listing.price.amountMinor ? it : best))
    : null;

  const rows: Array<{ label: string; render: (l: ProductListing) => React.ReactNode }> = [
    {
      label: "Price",
      render: (l) => (
        <span className={`font-semibold ${cheapest && l.id === cheapest.listing.id ? "text-success" : ""}`}>
          {formatMinor(l.price.amountMinor, l.price.currency)}
          {cheapest && l.id === cheapest.listing.id ? (
            <Badge tone="success" className="ml-2">Lowest</Badge>
          ) : null}
        </span>
      ),
    },
    { label: "Availability", render: (l) => l.availability.replace("_", " ") },
    { label: "Merchant", render: (l) => l.provider },
    { label: "Brand", render: (l) => l.brand ?? "—" },
    { label: "Seller", render: (l) => l.seller ?? "—" },
    { label: "Rating", render: (l) => (l.rating ? `★ ${l.rating.value.toFixed(1)} (${l.rating.count})` : "—") },
    { label: "Category", render: (l) => l.category ?? "—" },
    { label: "Data freshness", render: (l) => formatAge(l.fetchedAt) },
  ];

  // merge attribute keys
  const attrKeys = Array.from(new Set(okItems.flatMap((it) => Object.keys(it.listing.attributes)))).slice(0, 12);
  for (const key of attrKeys) {
    rows.push({ label: key, render: (l) => (key in l.attributes ? String(l.attributes[key]) : "—") });
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Compare"
        subtitle="Side-by-side from sourced listing data. A dash (—) means the source did not provide that value."
      />

      {failed.length > 0 ? (
        <Card className="border-warn/30 bg-warn/5 p-3.5 text-xs text-warn">
          {failed.map((f) => (
            <p key={f.id}>
              {f.id}: {f.message}
            </p>
          ))}
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-3 text-left text-xs font-medium text-faint">Attribute</th>
              {okItems.map((it) => (
                <th key={it.listing.id} className="p-3 text-left align-top">
                  <div className="flex flex-col gap-1.5">
                    <Badge tone="accent">{it.listing.provider}</Badge>
                    <a
                      href={`/products/${encodeURIComponent(it.listing.provider)}/${encodeURIComponent(it.listing.externalId)}?region=${it.listing.region}`}
                      className="line-clamp-2 font-medium hover:text-accent"
                    >
                      {it.listing.title}
                    </a>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line/50 last:border-0">
                <td className="p-3 text-xs text-faint whitespace-nowrap">{row.label}</td>
                {okItems.map((it) => (
                  <td key={it.listing.id} className="p-3 text-text align-top">
                    {row.render(it.listing)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="p-3 text-xs text-faint">Action</td>
              {okItems.map((it) => (
                <td key={it.listing.id} className="p-3">
                  <a
                    href={it.listing.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-xs text-accent hover:underline"
                  >
                    Open at {it.listing.provider} ↗
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="flex justify-center">
        <ButtonLink href="/search" variant="ghost">
          ← Back to search
        </ButtonLink>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted">
          <Spinner className="mr-2" /> Loading…
        </div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
