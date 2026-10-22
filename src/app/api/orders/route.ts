import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/db/session";
import { isDbConfigured } from "@/lib/db/client";
import { listOrders } from "@/lib/db/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Database is not configured." } }, { status: 503 });
  }
  const userId = await getSessionUserId();
  const orders = await listOrders(userId);
  return NextResponse.json({ orders });
}
