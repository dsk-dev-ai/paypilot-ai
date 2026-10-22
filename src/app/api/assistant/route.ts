import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, getAIStatus } from "@/providers/ai";
import { aggregateSearch } from "@/lib/providers/aggregator";
import { ensureProvidersRegistered } from "@/lib/providers";
import { listProviders } from "@/lib/providers/registry";
import { upsertListing } from "@/lib/db/listings";
import { isDbConfigured } from "@/lib/db/client";
import { searchRateLimiter } from "@/lib/http/rate-limit";
import { SUPPORTED_CURRENCIES } from "@/lib/core/money";
import { SearchQuerySchema } from "@/lib/core/provider";
import { RegionCodeSchema } from "@/lib/core/listing";
import { recordAuditEvent } from "@/lib/db/audit";
import { getSessionUserId } from "@/lib/db/session";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  budgetMinor: z.number().int().nonnegative().max(100_000_000).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  region: RegionCodeSchema.optional(),
});

/**
 * POST /api/assistant — AI-assisted shopping search.
 * The AI only produces SEARCH QUERIES (schema-validated); all listings come
 * from real provider APIs. Invented AI output is rejected by strict parsing
 * and the deterministic fallback takes over.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!searchRateLimiter.tryConsume(key)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many assistant requests, slow down." } },
      { status: 429 }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid assistant request", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }

  const provider = getAIProvider();
  const plan = await provider.plan(parsed.data);

  await ensureProvidersRegistered();
  const searchResults = await Promise.all(
    plan.searches.map(async (s) => {
      const query = SearchQuerySchema.parse({
        q: s.q,
        region: s.region,
        currency: parsed.data.currency ?? "INR",
        minPriceMinor: s.minPriceMinor,
        maxPriceMinor: s.maxPriceMinor,
        limit: s.maxResults,
      });
      const result = await aggregateSearch(query);
      if (isDbConfigured()) {
        for (const listing of result.listings) {
          await upsertListing(listing).catch(() => undefined);
        }
      }
      return { search: s, listings: result.listings, outcomes: result.outcomes, partial: result.partial };
    })
  );

  const officialLinks = listProviders()
    .map((p) => {
      const status = p.getStatus();
      if (status.state !== "NOT_CONFIGURED" && status.state !== "ACCESS_PENDING") return null;
      const url = p.officialSearchUrl?.(plan.searches[0].q, plan.searches[0].region);
      if (!url) return null;
      return { provider: p.id, label: p.label, url, reason: status.message };
    })
    .filter((x): x is { provider: string; label: string; url: string; reason: string } => x !== null);

  const userId = await getSessionUserId();
  await recordAuditEvent("ASSISTANT_QUERY", `Assistant query: ${parsed.data.message.slice(0, 80)}`, {
    userId,
    metadata: { source: provider.id, searches: plan.searches.length },
  }).catch(() => undefined);

  return NextResponse.json({
    reply: plan.reply,
    reasoning: plan.reasoning,
    source: provider.id,
    aiStatus: getAIStatus(),
    searches: plan.searches,
    results: searchResults,
    officialLinks,
  });
}
