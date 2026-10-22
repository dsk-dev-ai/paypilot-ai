import { NextResponse } from "next/server";
import { ensureProvidersRegistered } from "@/lib/providers";
import { listProviderStatuses } from "@/lib/providers/registry";
import { isDbConfigured } from "@/lib/db/client";
import { getPayPalStatus } from "@/modules/payments/config";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureProvidersRegistered();
  const search = listProviderStatuses();
  const checkout = [getPayPalStatus()];
  const database = {
    id: "postgres",
    label: "PostgreSQL",
    state: isDbConfigured() ? ("CONFIGURED" as const) : ("NOT_CONFIGURED" as const),
    message: isDbConfigured()
      ? "DATABASE_URL is set. Run `npm run db:migrate` if this is a fresh database."
      : "DATABASE_URL is missing. Plans, orders, wishlist and notifications are unavailable.",
  };
  return NextResponse.json({
    search,
    checkout,
    database,
    checkedAt: new Date().toISOString(),
  });
}
