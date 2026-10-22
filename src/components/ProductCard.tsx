"use client";

import type { ProductListing } from "@/lib/core/listing";
import { formatMinor, formatAge } from "@/lib/money-format";
import { Badge, Card } from "@/components/ui/Card";
import Link from "next/link";

const providerTone: Record<string, "accent" | "info" | "neutral"> = {
  ebay: "accent",
  flipkart: "info",
};

export function ProductCard({
  listing,
  selected,
  onToggleCompare,
  compareDisabled,
  onAddToPlan,
  addedToPlan,
  onSave,
  saved,
}: {
  listing: ProductListing;
  selected?: boolean;
  onToggleCompare?: (id: string) => void;
  compareDisabled?: boolean;
  onAddToPlan?: (listing: ProductListing) => void;
  addedToPlan?: boolean;
  onSave?: (listing: ProductListing) => void;
  saved?: boolean;
}) {
  const detailHref = `/products/${encodeURIComponent(listing.provider)}/${encodeURIComponent(listing.externalId)}?region=${listing.region}`;
  const availTone =
    listing.availability === "IN_STOCK"
      ? "success"
      : listing.availability === "OUT_OF_STOCK"
        ? "danger"
        : "warn";
  return (
    <Card
      className="group relative flex flex-col overflow-hidden"
      interactive
    >
      {onToggleCompare ? (
        <label className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-line bg-bg/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur cursor-pointer hover:border-accent/50">
          <input
            type="checkbox"
            checked={!!selected}
            disabled={!selected && compareDisabled}
            onChange={() => onToggleCompare(listing.id)}
            className="accent-accent"
          />
          Compare
        </label>
      ) : null}
      <Link href={detailHref} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-panel">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.06]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-faint text-3xl">▢</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <Badge tone={providerTone[listing.provider] ?? "neutral"}>{listing.provider}</Badge>
            <Badge tone={availTone}>{listing.availability.replace("_", " ")}</Badge>
          </div>
          <h3 className="line-clamp-2 text-sm font-medium text-text leading-snug">{listing.title}</h3>
          <div className="mt-auto flex items-baseline gap-2 pt-1">
            <span className="text-lg font-semibold text-text">
              {formatMinor(listing.price.amountMinor, listing.price.currency)}
            </span>
            {listing.originalPrice && listing.originalPrice.amountMinor > listing.price.amountMinor ? (
              <span className="text-xs text-faint line-through">
                {formatMinor(listing.originalPrice.amountMinor, listing.price.currency)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
            {listing.brand ? <span>{listing.brand}</span> : null}
            {listing.seller ? <span>Sold by {listing.seller}</span> : null}
            {listing.rating ? (
              <span>
                ★ {listing.rating.value.toFixed(1)} ({listing.rating.count})
              </span>
            ) : null}
            <span title={listing.fetchedAt}>Updated {formatAge(listing.fetchedAt)}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <a
          href={listing.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-xs text-accent hover:underline"
        >
          Open at {listing.provider} ↗
        </a>
        <div className="flex items-center gap-1.5">
          {onSave ? (
            <button
              type="button"
              onClick={() => onSave(listing)}
              disabled={saved}
              title={saved ? "Saved to wishlist" : "Save to wishlist"}
              className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                saved
                  ? "border-success/40 text-success cursor-default"
                  : "border-line text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {saved ? "♥" : "♡"}
            </button>
          ) : null}
          {onAddToPlan ? (
            <button
              type="button"
              onClick={() => onAddToPlan(listing)}
              disabled={addedToPlan}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                addedToPlan
                  ? "border-success/40 text-success cursor-default"
                  : "border-line text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {addedToPlan ? "In plan ✓" : "Add to plan"}
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
