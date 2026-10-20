import { NextResponse } from "next/server";

export async function GET() {
  const configured = {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    db: !!process.env.DATABASE_URL,
  };
  return NextResponse.json({ status: "ok", configured });
}
