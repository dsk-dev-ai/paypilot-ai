import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getActiveDraftPlan, createPlan, getPlan } from "@/lib/db/plans";
import { getLatestConsent } from "@/lib/db/consents";
import { SUPPORTED_CURRENCIES } from "@/lib/core/money";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured; the shopping plan is unavailable." } },
      { status: 503 }
    );
  }
  return null;
}

/** GET /api/plan — the user's active draft plan (or most recent approved plan). */
export async function GET() {
  const g = guard();
  if (g) return g;
  const userId = await getSessionUserId();
  const draft = await getActiveDraftPlan(userId);
  if (draft) {
    return NextResponse.json({ plan: draft, consent: await getLatestConsent(userId, draft.id) });
  }
  const { getDb } = await import("@/lib/db/client");
  const recent = await getDb().shoppingPlan.findFirst({
    where: { userId, status: { in: ["APPROVED", "CHECKOUT_IN_PROGRESS", "CHECKED_OUT"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (recent) {
    return NextResponse.json({
      plan: await getPlan(userId, recent.id),
      consent: await getLatestConsent(userId, recent.id),
    });
  }
  return NextResponse.json({ plan: null, consent: null });
}

const CreateSchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES),
  mandateId: z.string().max(100).optional(),
});

/** POST /api/plan — create a fresh draft plan (cancels an empty draft if present). */
export async function POST(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  const g = guard();
  if (g) return g;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid plan request" } }, { status: 400 });
  }
  const userId = await getSessionUserId();
  const existing = await getActiveDraftPlan(userId);
  if (existing && existing.items.length === 0) {
    return NextResponse.json({ plan: existing });
  }
  const plan = await createPlan(userId, parsed.data.currency, parsed.data.mandateId);
  return NextResponse.json({ plan }, { status: 201 });
}
