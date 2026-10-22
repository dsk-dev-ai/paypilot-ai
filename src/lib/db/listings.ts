import { getDb, bigIntToNumber, numberToBigInt } from "./client";
import type { ProductListing } from "@/lib/core/listing";
import { listingId } from "@/lib/core/listing";

export type StoredListing = ProductListing & { recordId: string };

export async function upsertListing(listing: ProductListing): Promise<StoredListing> {
  const db = getDb();
  const record = await db.listingRecord.upsert({
    where: {
      provider_externalId_region: {
        provider: listing.provider,
        externalId: listing.externalId,
        region: listing.region,
      },
    },
    update: {
      title: listing.title,
      canonicalUrl: listing.canonicalUrl,
      imageUrl: listing.imageUrl ?? null,
      priceMinor: numberToBigInt(listing.price.amountMinor),
      currency: listing.price.currency,
      originalPriceMinor: listing.originalPrice
        ? numberToBigInt(listing.originalPrice.amountMinor)
        : null,
      availability: listing.availability,
      seller: listing.seller ?? null,
      brand: listing.brand ?? null,
      category: listing.category ?? null,
      ratingValue: listing.rating?.value ?? null,
      ratingCount: listing.rating?.count ?? null,
      attributes: listing.attributes,
      attribution: listing.attribution ?? null,
      fetchedAt: new Date(listing.fetchedAt),
    },
    create: {
      provider: listing.provider,
      externalId: listing.externalId,
      region: listing.region,
      title: listing.title,
      canonicalUrl: listing.canonicalUrl,
      imageUrl: listing.imageUrl ?? null,
      priceMinor: numberToBigInt(listing.price.amountMinor),
      currency: listing.price.currency,
      originalPriceMinor: listing.originalPrice
        ? numberToBigInt(listing.originalPrice.amountMinor)
        : null,
      availability: listing.availability,
      seller: listing.seller ?? null,
      brand: listing.brand ?? null,
      category: listing.category ?? null,
      ratingValue: listing.rating?.value ?? null,
      ratingCount: listing.rating?.count ?? null,
      attributes: listing.attributes,
      attribution: listing.attribution ?? null,
      fetchedAt: new Date(listing.fetchedAt),
    },
  });
  return toStoredListing(record);
}

export async function getListingRecord(recordId: string): Promise<StoredListing | null> {
  const record = await getDb().listingRecord.findUnique({ where: { id: recordId } });
  return record ? toStoredListing(record) : null;
}

export async function getListingByProviderId(
  provider: string,
  externalId: string,
  region: string
): Promise<StoredListing | null> {
  const record = await getDb().listingRecord.findUnique({
    where: { provider_externalId_region: { provider, externalId, region } },
  });
  return record ? toStoredListing(record) : null;
}

type ListingRecordRow = {
  id: string;
  provider: string;
  externalId: string;
  region: string;
  title: string;
  canonicalUrl: string;
  imageUrl: string | null;
  priceMinor: bigint;
  currency: string;
  originalPriceMinor: bigint | null;
  availability: string;
  seller: string | null;
  brand: string | null;
  category: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  attributes: unknown;
  attribution: string | null;
  fetchedAt: Date;
};

function toStoredListing(row: ListingRecordRow): StoredListing {
  const currency = row.currency as ProductListing["price"]["currency"];
  const ratingValue = row.ratingValue;
  const ratingCount = row.ratingCount;
  const originalMinor = bigIntToNumber(row.originalPriceMinor);
  const attrs =
    row.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes)
      ? (row.attributes as Record<string, string | number | boolean>)
      : {};
  return {
    recordId: row.id,
    id: listingId(row.provider, row.externalId),
    provider: row.provider,
    externalId: row.externalId,
    region: row.region as ProductListing["region"],
    title: row.title,
    canonicalUrl: row.canonicalUrl,
    imageUrl: row.imageUrl ?? undefined,
    price: { amountMinor: bigIntToNumber(row.priceMinor)!, currency },
    originalPrice:
      originalMinor !== undefined ? { amountMinor: originalMinor, currency } : undefined,
    availability: row.availability as ProductListing["availability"],
    seller: row.seller ?? undefined,
    brand: row.brand ?? undefined,
    category: row.category ?? undefined,
    rating:
      ratingValue !== null && ratingCount !== null
        ? { value: ratingValue, count: ratingCount }
        : undefined,
    attributes: attrs,
    attribution: row.attribution ?? undefined,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}
