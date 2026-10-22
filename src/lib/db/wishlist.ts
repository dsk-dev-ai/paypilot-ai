import { getDb, bigIntToNumber } from "./client";

export type WishlistItemDTO = {
  id: string;
  listingId: string;
  provider: string;
  externalId: string;
  title: string;
  canonicalUrl: string;
  imageUrl?: string;
  priceMinor: number;
  currency: string;
  availability: string;
  note: string | null;
  addedAt: string;
  fetchedAt: string;
};

type WishlistRow = {
  id: string;
  note: string | null;
  addedAt: Date;
  listing: {
    id: string;
    provider: string;
    externalId: string;
    title: string;
    canonicalUrl: string;
    imageUrl: string | null;
    priceMinor: bigint;
    currency: string;
    availability: string;
    fetchedAt: Date;
  };
};

function toDTO(row: WishlistRow): WishlistItemDTO {
  return {
    id: row.id,
    listingId: row.listing.id,
    provider: row.listing.provider,
    externalId: row.listing.externalId,
    title: row.listing.title,
    canonicalUrl: row.listing.canonicalUrl,
    imageUrl: row.listing.imageUrl ?? undefined,
    priceMinor: bigIntToNumber(row.listing.priceMinor)!,
    currency: row.listing.currency,
    availability: row.listing.availability,
    note: row.note,
    addedAt: row.addedAt.toISOString(),
    fetchedAt: row.listing.fetchedAt.toISOString(),
  };
}

const include = { listing: true } as const;

export async function listWishlist(userId: string): Promise<WishlistItemDTO[]> {
  const rows = await getDb().wishlistItem.findMany({
    where: { userId },
    include,
    orderBy: { addedAt: "desc" },
  });
  return rows.map(toDTO);
}

/** Idempotent add — saving an already-saved listing is a no-op. */
export async function addWishlistItem(
  userId: string,
  listingRecordId: string,
  note?: string
): Promise<WishlistItemDTO> {
  const db = getDb();
  const row = await db.wishlistItem.upsert({
    where: { userId_listingId: { userId, listingId: listingRecordId } },
    update: note != null ? { note } : {},
    create: { userId, listingId: listingRecordId, note: note ?? null },
    include,
  });
  return toDTO(row);
}

export async function removeWishlistItem(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const row = await db.wishlistItem.findFirst({ where: { id, userId } });
  if (!row) return false;
  await db.wishlistItem.delete({ where: { id: row.id } });
  return true;
}
