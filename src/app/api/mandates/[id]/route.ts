import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getMandate, updateMandate, deleteMandate } from "@/lib/db/mandates";
import { SUPPORTED_CURRENCIES } from "@/lib/core/money";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  budgetMinor: z.number().int().nonnegative().max(1_000_000_000).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  minUnspentMinor: z.number().int().nonnegative().optional(),
  preferredBrands: z.array(z.string().min(1).max(100)).max(30).optional(),
  excludedBrands: z.array(z.string().min(1).max(100)).max(30).optional(),
  requiredAttributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  maxQuantityPerItem: z.number().int().min(1).max(99).optional(),
  maxTotalItems: z.number().int().min(1).max(100).optional(),
  allowedProviders: z.array(z.string().min(2).max(50)).max(20).optional(),
  excludedProviders: z.array(z.string().min(2).max(50)).max(20).optional(),
  allowedDestinations: z.array(z.enum(["IN", "US", "UK", "EU"])).max(4).optional(),
  maxListingAgeMinutes: z.number().int().min(5).max(43200).optional(),
  active: z.boolean().optional(),
});

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard();
  if (g) return g;
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const mandate = await getMandate(userId, id);
  if (!mandate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Mandate not found" } }, { status: 404 });
  }
  return NextResponse.json({ mandate });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  const g = guard();
  if (g) return g;
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid mandate patch", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }
  const userId = await getSessionUserId();
  const mandate = await updateMandate(userId, id, parsed.data);
  if (!mandate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Mandate not found" } }, { status: 404 });
  }
  return NextResponse.json({ mandate });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard();
  if (g) return g;
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const ok = await deleteMandate(userId, id);
  if (!ok) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Mandate not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
