import { NextResponse } from "next/server";
import { CATALOG, CATALOG_CURRENCY } from "@/lib/catalog/products";
import { getPayPalStatus } from "@/modules/payments/config";
import { getAIStatus } from "@/providers/ai";

export const dynamic = "force-dynamic";

/** GET /api/catalog — the built-in digital merchant catalog (no DB required). */
export async function GET() {
  return NextResponse.json({
    products: CATALOG,
    currency: CATALOG_CURRENCY,
    paypal: getPayPalStatus(),
    ai: getAIStatus(),
  });
}
