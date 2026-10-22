import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { getActiveDraftPlan, setPlanStatus } from "@/lib/db/plans";
import { recordAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

/** POST /api/plan/cancel — cancel the active plan (draft or approved). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const userId = await getSessionUserId();
  const plan = await getActiveDraftPlan(userId);
  if (!plan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "No active plan" } }, { status: 404 });
  }
  const updated = await setPlanStatus(userId, plan.id, "CANCELED");
  await recordAuditEvent("PLAN_CANCELED", "Plan canceled", { userId, metadata: { planId: plan.id } });
  return NextResponse.json({ plan: updated });
}
