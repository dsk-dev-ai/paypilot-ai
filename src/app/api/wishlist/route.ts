import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { listWishlist, addWishlistItem } from "@/lib/db/wishlist";
import { getListingByProviderId } from "@/lib/db/listings";
import { RegionCodeSchema } from "@/lib/core/listing";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  return null;
}

export async function GET() {
  const g = guard();
  if (g) return g;
  const userId = await getSessionUserId();
  const items = await listWishlist(userId);
  return NextResponse.json({ items });
}

const AddSchema = z.object({
  provider: z.string().min(2).max(50),
  externalId: z.string().min(1).max(200),
  region: RegionCodeSchema.default("IN"),
  note: z.string().trim().max(300).optional(),
});

/** POST /api/wishlist — save a verified listing snapshot. Unknown listings are rejected. */
export async function POST(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  const g = guard();
  if (g) return g;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = AddSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid wishlist entry" } }, { status: 400 });
  }
  const { provider, externalId, region, note } = parsed.data;
  const userId = await getSessionUserId();
  const listing = await getListingByProviderId(provider, externalId, region);
  if (!listing) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Only verified search snapshots can be saved. Run a search first.",
        },
      },
      { status: 404 }
    );
  }
  const item = await addWishlistItem(userId, listing.recordId, note);
  return NextResponse.json({ item }, { status: 201 });
}
