import { describe, test, expect } from "vitest";
import { assertSafeExternalUrl } from "@/lib/http/url-guard";
import { ProductListingSchema } from "@/lib/core/listing";
import { RateLimiter } from "@/lib/http/rate-limit";
import { newUserId } from "@/lib/db/session";
import { isProviderError } from "@/lib/core/errors";

describe("SSRF guard", () => {
  test("allows normal https URLs", () => {
    expect(assertSafeExternalUrl("https://www.ebay.in/itm/123").hostname).toBe("www.ebay.in");
  });

  test.each([
    "http://localhost/admin",
    "http://127.0.0.1:5432/",
    "http://10.0.0.5/",
    "http://172.16.1.1/",
    "http://192.168.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/",
    "http://foo.internal/",
    "http://service.local/",
  ])("blocks private/metadata target %s", (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow();
  });

  test("blocks non-http protocols", () => {
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "ftp://example.com/x"]) {
      try {
        assertSafeExternalUrl(url);
        throw new Error("expected to throw");
      } catch (e) {
        expect(isProviderError(e)).toBe(true);
      }
    }
  });

  test("blocks IPv6 loopback and link-local", () => {
    for (const url of ["http://[::1]/", "http://[fe80::1]/", "http://[fc00::1]/"]) {
      expect(() => assertSafeExternalUrl(url)).toThrow();
    }
  });
});

describe("listing URL hardening", () => {
  const base = {
    id: "ebay:1",
    provider: "ebay",
    externalId: "1",
    title: "Item",
    price: { amountMinor: 100, currency: "INR" },
    availability: "IN_STOCK" as const,
    region: "IN" as const,
    fetchedAt: new Date().toISOString(),
  };

  test("accepts https canonical URLs", () => {
    expect(ProductListingSchema.safeParse({ ...base, canonicalUrl: "https://www.ebay.in/itm/1" }).success).toBe(true);
  });

  test("rejects javascript: and data: URLs", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd"]) {
      expect(ProductListingSchema.safeParse({ ...base, canonicalUrl: url }).success).toBe(false);
    }
  });
});

describe("rate limiter", () => {
  test("consumes tokens then refills over time", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1, () => now);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false);
    now = 1000;
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false);
  });

  test("buckets are isolated per key", () => {
    const rl = new RateLimiter(1, 0.001);
    expect(rl.tryConsume("ip1")).toBe(true);
    expect(rl.tryConsume("ip1")).toBe(false);
    expect(rl.tryConsume("ip2")).toBe(true);
  });
});

describe("anonymous session ids", () => {
  test("are random, prefixed, and non-sequential", () => {
    const a = newUserId();
    const b = newUserId();
    expect(a).toMatch(/^u_[0-9a-f]{32}$/);
    expect(b).toMatch(/^u_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
