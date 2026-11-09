import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { createMandate, listMandates } from "@/lib/db/mandates";
import { recordAuditEvent } from "@/lib/db/audit";
import { rateLimit } from "@/lib/http/api";
import { mutationRateLimiter } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/bootstrap — create (or reuse) a demo spending mandate for the
 * current anonymous session. This is what a judge clicks before running the
 * agent: a signed $100 budget limited to the built-in store.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, mutationRateLimiter);
  if (limited) return limited;
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  const userId = await getSessionUserId();
  const existing = (await listMandates(userId)).find((m) => m.active && m.name === "Hackathon Demo Budget");
  if (existing) {
    return NextResponse.json({ mandate: existing, reused: true });
  }
  const mandate = await createMandate(userId, {
    name: "Hackathon Demo Budget",
    budgetMinor: 10_000,
    currency: "USD",
    minUnspentMinor: 0,
    maxQuantityPerItem: 2,
    maxTotalItems: 8,
    allowedProviders: ["paypilot"],
    allowedDestinations: ["US"],
    maxListingAgeMinutes: 1440,
    active: true,
  });
  await recordAuditEvent("MANDATE_CREATED", `Demo mandate "${mandate.name}" created`, {
    userId,
    metadata: { mandateId: mandate.id, budgetMinor: mandate.budgetMinor, currency: mandate.currency },
  }).catch(() => undefined);
  return NextResponse.json({ mandate, reused: false }, { status: 201 });
}
