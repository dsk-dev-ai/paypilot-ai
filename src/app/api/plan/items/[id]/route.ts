import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { updatePlanItemQuantity, removePlanItem } from "@/lib/db/plans";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({ quantity: z.number().int().min(0).max(99) });

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  return null;
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
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid quantity" } }, { status: 400 });
  }
  const userId = await getSessionUserId();
  const plan =
    parsed.data.quantity === 0
      ? await removePlanItem(userId, id)
      : await updatePlanItemQuantity(userId, id, parsed.data.quantity);
  if (!plan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Plan item not found" } }, { status: 404 });
  }
  return NextResponse.json({ plan });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard();
  if (g) return g;
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  const plan = await removePlanItem(userId, id);
  if (!plan) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Plan item not found" } }, { status: 404 });
  }
  return NextResponse.json({ plan });
}
