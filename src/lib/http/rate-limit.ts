type Bucket = { tokens: number; updatedAt: number };

/** In-memory token-bucket rate limiter, per key (e.g. IP or session). */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now
  ) {}

  /** Returns true if the request is allowed, false if it should be rejected. */
  tryConsume(key: string, cost = 1): boolean {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, updatedAt: t };
      this.buckets.set(key, bucket);
    }
    const elapsedSec = (t - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSecond);
    bucket.updatedAt = t;
    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
  }

  reset(): void {
    this.buckets.clear();
  }
}

export const searchRateLimiter = new RateLimiter(30, 5);
/** Stricter bucket for state-changing endpoints (plan, mandate, checkout, wishlist). */
export const mutationRateLimiter = new RateLimiter(20, 2);
/** Checkout/payment actions are expensive — tighter still. */
export const checkoutRateLimiter = new RateLimiter(10, 0.5);

/** Best-effort client key from proxy headers (falls back to a shared bucket). */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

