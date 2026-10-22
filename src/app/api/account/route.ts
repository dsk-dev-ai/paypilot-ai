import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured, getDb } from "@/lib/db/client";
import { getPayPalStatus } from "@/modules/payments/config";
import { getAIStatus } from "@/providers/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/account — honest session summary for the anonymous user:
 * what data exists, which integrations are live, and no invented profile.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const userId = await getSessionUserId();
  const db = getDb();
  const [mandates, plans, orders, wishlist, notifications, audit] = await Promise.all([
    db.mandate.count({ where: { userId } }),
    db.shoppingPlan.count({ where: { userId } }),
    db.order.count({ where: { userId } }),
    db.wishlistItem.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.auditEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    session: {
      userId,
      authModel: "anonymous cookie session — no email, no password, no retailer accounts",
    },
    counts: { mandates, plans, orders, wishlist, unreadNotifications: notifications },
    integrations: {
      paypal: getPayPalStatus(),
      ai: getAIStatus(),
    },
    recentActivity: audit.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
