import { NextRequest, NextResponse } from "next/server";
import { ensureProvidersRegistered } from "@/lib/providers";
import { getProvider } from "@/lib/providers/registry";
import { getListingByProviderId, upsertListing } from "@/lib/db/listings";
import { isDbConfigured } from "@/lib/db/client";
import { isProviderError } from "@/lib/core/errors";
import { ProductListingSchema } from "@/lib/core/listing";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/[provider]/[externalId]?region=IN
 * Live details when the provider is configured, otherwise the latest
 * persisted snapshot with an honest `stale` marker. Never invents data.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string; externalId: string }> }
) {
  const { provider: providerId, externalId } = await ctx.params;
  const region = req.nextUrl.searchParams.get("region") ?? "IN";
  if (!/^[A-Za-z0-9:_|-]{1,200}$/.test(externalId)) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid product id" } }, { status: 400 });
  }
  if (!["IN", "US", "UK", "EU"].includes(region)) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid region" } }, { status: 400 });
  }

  await ensureProvidersRegistered();
  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown provider" } }, { status: 404 });
  }

  const snapshot = isDbConfigured()
    ? await getListingByProviderId(providerId, externalId, region).catch(() => null)
    : null;

  const status = provider.getStatus();
  const canLive =
    provider.getProduct &&
    (status.state === "CONFIGURED" || status.state === "VERIFIED");

  if (canLive && provider.getProduct) {
    try {
      const live = await provider.getProduct(externalId, region as "IN");
      if (live) {
        const validated = ProductListingSchema.parse(live);
        if (isDbConfigured()) {
          await upsertListing(validated).catch(() => undefined);
        }
        return NextResponse.json({
          listing: validated,
          freshness: "live",
          providerStatus: status,
        });
      }
    } catch (e) {
      if (!isProviderError(e) || e.code === "NOT_CONFIGURED") {
        // fall through to snapshot
      } else if (!snapshot) {
        return NextResponse.json(
          { error: { code: e.code, message: e.message }, snapshot: null },
          { status: 502 }
        );
      }
      // fall through to snapshot with stale marker
    }
  }

  if (snapshot) {
    const ageMs = Date.now() - new Date(snapshot.fetchedAt).getTime();
    return NextResponse.json({
      listing: snapshot,
      freshness: "snapshot",
      stale: ageMs > 60 * 60 * 1000,
      providerStatus: status,
    });
  }

  return NextResponse.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "No live or cached data for this product. The provider may not be configured.",
      },
      providerStatus: status,
    },
    { status: 404 }
  );
}
