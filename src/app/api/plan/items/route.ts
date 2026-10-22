import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { addListingToPlan } from "@/lib/db/plans";
import { getListingByProviderId, upsertListing } from "@/lib/db/listings";
import { ensureProvidersRegistered } from "@/lib/providers";
import { getProvider } from "@/lib/providers/registry";
import { isProviderError } from "@/lib/core/errors";
import { recordAuditEvent } from "@/lib/db/audit";
import { RegionCodeSchema } from "@/lib/core/listing";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const AddSchema = z.object({
  provider: z.string().min(2).max(50),
  externalId: z.string().min(1).max(200),
  region: RegionCodeSchema.default("IN"),
  quantity: z.number().int().min(1).max(99).default(1),
});

/**
 * POST /api/plan/items — add a real listing to the unified plan.
 * Resolves the listing from persisted search snapshots, or fetches live
 * details when the provider is configured. Rejects unknown listings.
 */
export async function POST(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured; the plan is unavailable." } },
      { status: 503 }
    );
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = AddSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid item", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }
  const { provider, externalId, region, quantity } = parsed.data;
  const userId = await getSessionUserId();

  await ensureProvidersRegistered();
  if (!getProvider(provider)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown provider" } }, { status: 404 });
  }

  let stored = await getListingByProviderId(provider, externalId, region);
  if (!stored) {
    const p = getProvider(provider)!;
    const status = p.getStatus();
    if (p.getProduct && (status.state === "CONFIGURED" || status.state === "VERIFIED")) {
      try {
        const live = await p.getProduct(externalId, region);
        if (live) {
          stored = await upsertListing(live);
        }
      } catch (e) {
        if (isProviderError(e) && e.code !== "NOT_CONFIGURED") {
          return NextResponse.json(
            { error: { code: e.code, message: `Could not verify listing with ${provider}: ${e.message}` } },
            { status: 502 }
          );
        }
      }
    }
  }
  if (!stored) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message:
            "This listing is not in your search results. Run a search first so Mandate can verify it with the source.",
        },
      },
      { status: 404 }
    );
  }

  const plan = await addListingToPlan(userId, stored.price.currency, stored.recordId, quantity);
  await recordAuditEvent("PLAN_ITEM_ADDED", `Added ${stored.title} to plan`, {
    userId,
    metadata: { planId: plan.id, listing: stored.id, quantity },
  });
  return NextResponse.json({ plan }, { status: 201 });
}
