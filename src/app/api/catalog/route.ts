import { NextResponse } from "next/server";
import { DEMO_CATALOG } from "@/modules/catalog/data";

export async function GET() {
  return NextResponse.json({ catalog: DEMO_CATALOG });
}
