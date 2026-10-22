import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { removeWishlistItem } from "@/lib/db/wishlist";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const ok = await removeWishlistItem(userId, id);
  if (!ok) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Wishlist item not found" } }, { status: 404 });
  }
  return NextResponse.json({ removed: true });
}
