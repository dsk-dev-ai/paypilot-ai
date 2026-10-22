import { NextResponse } from "next/server";
import { isDbConfigured, getDb } from "@/lib/db/client";
import { getPayPalStatus } from "@/modules/payments/config";
import { getAIStatus } from "@/providers/ai";

export const dynamic = "force-dynamic";

/** GET /api/health — honest liveness + configuration state. No secrets. */
export async function GET() {
  let database = "not_configured";
  if (isDbConfigured()) {
    try {
      await getDb().$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "error";
    }
  }
  return NextResponse.json({
    status: database === "error" ? "degraded" : "ok",
    database,
    configured: {
      gemini: !!process.env.GEMINI_API_KEY,
      paypal: getPayPalStatus().state !== "NOT_CONFIGURED",
      db: isDbConfigured(),
    },
    integrations: {
      paypal: getPayPalStatus().state,
      ai: getAIStatus().state,
    },
  });
}
