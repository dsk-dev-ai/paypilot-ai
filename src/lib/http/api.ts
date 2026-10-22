import { NextResponse } from "next/server";
import { clientKey, type RateLimiter } from "./rate-limit";

/** Returns a 429 response when the bucket is exhausted, otherwise null. */
export function rateLimit(req: Request, limiter: RateLimiter): NextResponse | null {
  if (!limiter.tryConsume(clientKey(req.headers))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests, slow down." } },
      { status: 429 }
    );
  }
  return null;
}
