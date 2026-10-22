import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { listNotifications, markNotificationRead } from "@/lib/db/notifications";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

function guard() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  return null;
}

export async function GET() {
  const g = guard();
  if (g) return g;
  const userId = await getSessionUserId();
  const items = await listNotifications(userId);
  return NextResponse.json({ items });
}

const PatchSchema = z.object({ id: z.string().min(1).max(64), read: z.boolean().default(true) });

export async function PATCH(req: NextRequest) {

  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  const g = guard();
  if (g) return g;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } }, { status: 400 });
  }
  const userId = await getSessionUserId();
  const ok = await markNotificationRead(userId, parsed.data.id);
  if (!ok) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Notification not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
