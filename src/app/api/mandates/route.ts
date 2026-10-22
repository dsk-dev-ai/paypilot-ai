import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { createMandate, listMandates } from "@/lib/db/mandates";
import { recordAuditEvent } from "@/lib/db/audit";
import { SUPPORTED_CURRENCIES } from "@/lib/core/money";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const MandateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  budgetMinor: z.number().int().nonnegative().max(1_000_000_000),
  currency: z.enum(SUPPORTED_CURRENCIES),
  minUnspentMinor: z.number().int().nonnegative().default(0),
  preferredBrands: z.array(z.string().min(1).max(100)).max(30).default([]),
  excludedBrands: z.array(z.string().min(1).max(100)).max(30).default([]),
  requiredAttributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  maxQuantityPerItem: z.number().int().min(1).max(99).default(5),
  maxTotalItems: z.number().int().min(1).max(100).default(20),
  allowedProviders: z.array(z.string().min(2).max(50)).max(20).default([]),
  excludedProviders: z.array(z.string().min(2).max(50)).max(20).default([]),
  allowedDestinations: z.array(z.enum(["IN", "US", "UK", "EU"])).max(4).default([]),
  maxListingAgeMinutes: z.number().int().min(5).max(43200).default(1440),
  active: z.boolean().default(true),
});

function dbGuard() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured; mandates cannot be saved." } },
      { status: 503 }
    );
  }
  return null;
}

export async function GET() {
  const guard = dbGuard();
  if (guard) return guard;
  const userId = await getSessionUserId();
  const mandates = await listMandates(userId);
  return NextResponse.json({ mandates });
}

export async function POST(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  const guard = dbGuard();
  if (guard) return guard;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = MandateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid mandate", details: parsed.error.issues.slice(0, 5) } },
      { status: 400 }
    );
  }
  const userId = await getSessionUserId();
  const mandate = await createMandate(userId, parsed.data);
  await recordAuditEvent("MANDATE_CREATED", `Mandate "${mandate.name}" created`, {
    userId,
    metadata: { mandateId: mandate.id, budgetMinor: mandate.budgetMinor, currency: mandate.currency },
  });
  return NextResponse.json({ mandate }, { status: 201 });
}
