import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { listLedgerEntries, verifyLedger } from "@/lib/db/ledger";

export const dynamic = "force-dynamic";

/** GET /api/ledger — recent hash-chain entries plus a full-chain verification. */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  await getSessionUserId();
  try {
    const [entries, verification] = await Promise.all([listLedgerEntries(20), verifyLedger()]);
    return NextResponse.json({ entries, verification });
  } catch {
    return NextResponse.json(
      { error: { code: "LEDGER_UNAVAILABLE", message: "Could not read the ledger." } },
      { status: 503 }
    );
  }
}
