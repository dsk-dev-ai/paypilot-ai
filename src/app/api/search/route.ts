import { NextRequest, NextResponse } from "next/server";
import { SearchQuerySchema } from "@/lib/core/provider";
import { aggregateSearch } from "@/lib/providers/aggregator";
import { ensureProvidersRegistered } from "@/lib/providers";
import { listProviders } from "@/lib/providers/registry";
import { upsertListing } from "@/lib/db/listings";
import { isDbConfigured } from "@/lib/db/client";
import { searchRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/search — aggregated multi-provider product search.
 * Body: SearchQuery (see SearchQuerySchema).
 * Listings are persisted as snapshots when the database is configured.
 */
export async function POST(req: NextRequest) {
  if (!searchRateLimiter.tryConsume(clientKey(req))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many search requests, slow down." } },
      { status: 429 }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON body" } }, { status: 400 });
  }
  const parsed = SearchQuerySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid search query", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }
  const query = parsed.data;
  await ensureProvidersRegistered();
  const result = await aggregateSearch(query, query.providers.length ? query.providers : undefined);

  if (isDbConfigured()) {
    for (const listing of result.listings) {
      await upsertListing(listing).catch(() => undefined);
    }
  }

  const officialLinks = listProviders()
    .map((p) => {
      const status = p.getStatus();
      if (status.state !== "NOT_CONFIGURED" && status.state !== "ACCESS_PENDING") return null;
      const url = p.officialSearchUrl?.(query.q, query.region);
      if (!url) return null;
      return { provider: p.id, label: p.label, url, reason: status.message };
    })
    .filter((x): x is { provider: string; label: string; url: string; reason: string } => x !== null);

  return NextResponse.json({ ...result, officialLinks });
}

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
