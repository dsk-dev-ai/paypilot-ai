import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured, getDb } from "@/lib/db/client";
import { listOrders } from "@/lib/db/orders";
import { listMandates } from "@/lib/db/mandates";
import { listLedgerEntries, verifyLedger } from "@/lib/db/ledger";

export const dynamic = "force-dynamic";

/** GET /api/dashboard — data for the AG Grid control room. */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Database is not configured." } },
      { status: 503 }
    );
  }
  const userId = await getSessionUserId();
  const [orders, mandates, ledger, verification, fulfillmentRows] = await Promise.all([
    listOrders(userId, 100),
    listMandates(userId),
    listLedgerEntries(50),
    verifyLedger(),
    getDb().fulfillment.findMany({ where: { userId }, orderBy: { deliveredAt: "desc" } }),
  ]);

  const fulfillmentByOrder = new Map(
    fulfillmentRows.map((row) => [
      row.orderId,
      {
        id: row.id,
        status: row.status,
        deliveredAt: row.deliveredAt.toISOString(),
        itemCount: Array.isArray(row.items) ? (row.items as unknown[]).length : 0,
      },
    ])
  );

  const paid = orders.filter((o) => o.state === "PAID");
  const activeMandates = mandates.filter((m) => m.active);
  const totalSpentMinor = paid.reduce((acc, o) => acc + o.totalMinor, 0);
  const totalBudgetMinor = activeMandates.reduce((acc, m) => acc + m.budgetMinor, 0);

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      fulfillment: fulfillmentByOrder.get(o.id) ?? null,
    })),
    mandates,
    ledger,
    verification,
    summary: {
      currency: orders[0]?.currency ?? "USD",
      orderCount: orders.length,
      paidCount: paid.length,
      fulfilledCount: fulfillmentRows.length,
      activeMandates: activeMandates.length,
      totalSpentMinor,
      totalBudgetMinor,
      remainingMinor: Math.max(0, totalBudgetMinor - totalSpentMinor),
      ledgerCount: verification.count,
      ledgerOk: verification.ok,
    },
  });
}
