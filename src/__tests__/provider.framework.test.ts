import { describe, test, expect, beforeEach } from "vitest";
import { TtlCache } from "@/lib/http/cache";
import { RateLimiter } from "@/lib/http/rate-limit";
import { assertSafeExternalUrl, safeFetch } from "@/lib/http/url-guard";
import { aggregateSearch, clearSearchCache } from "@/lib/providers/aggregator";
import { registerProvider } from "@/lib/providers/registry";
import type { ProductProvider } from "@/lib/providers/types";
import type { ProductListing } from "@/lib/core/listing";
import type { SearchQuery } from "@/lib/core/provider";
import { ProviderError } from "@/lib/core/errors";
import { parseMoney } from "@/lib/core/money";

describe("TtlCache", () => {
  test("stores, deletes and clears entries", () => {
    const cache = new TtlCache(1000);
    cache.set("a", 1, 100);
    expect(cache.get("a")).toBe(1);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe("RateLimiter", () => {
  test("allows up to capacity then rejects, refills over time", () => {
    let t = 0;
    const rl = new RateLimiter(3, 1, () => t);
    expect(rl.tryConsume("k")).toBe(true);
    expect(rl.tryConsume("k")).toBe(true);
    expect(rl.tryConsume("k")).toBe(true);
    expect(rl.tryConsume("k")).toBe(false);
    t += 2000; // +2 tokens
    expect(rl.tryConsume("k")).toBe(true);
    expect(rl.tryConsume("k")).toBe(true);
    expect(rl.tryConsume("k")).toBe(false);
  });

  test("keys are independent", () => {
    const rl = new RateLimiter(1, 0);
    expect(rl.tryConsume("a")).toBe(true);
    expect(rl.tryConsume("a")).toBe(false);
    expect(rl.tryConsume("b")).toBe(true);
  });
});

describe("SSRF-safe URL guard", () => {
  test("allows public https URLs", () => {
    expect(assertSafeExternalUrl("https://api.ebay.com/x").hostname).toBe("api.ebay.com");
    expect(assertSafeExternalUrl("https://www.flipkart.com/search?q=phone").hostname).toBe("www.flipkart.com");
  });

  test("rejects localhost, private IPs, metadata, bad protocols", () => {
    expect(() => assertSafeExternalUrl("http://localhost:5432")).toThrow(ProviderError);
    expect(() => assertSafeExternalUrl("http://127.0.0.1/admin")).toThrow();
    expect(() => assertSafeExternalUrl("http://10.0.0.5/")).toThrow();
    expect(() => assertSafeExternalUrl("http://192.168.1.1/")).toThrow();
    expect(() => assertSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertSafeExternalUrl("http://172.20.0.3/")).toThrow();
    expect(() => assertSafeExternalUrl("file:///etc/passwd")).toThrow();
    expect(() => assertSafeExternalUrl("ftp://example.com")).toThrow();
    expect(() => assertSafeExternalUrl("not a url")).toThrow();
  });

  test("safeFetch rejects unsafe URLs without network access", async () => {
    await expect(safeFetch("http://127.0.0.1:1/")).rejects.toThrow(/not allowed|private/);
  });
});

// ── aggregator with fake providers ─────────────────────────────────────

function fakeListing(id: string, provider: string, priceMinor: number): ProductListing {
  return {
    id: `${provider}:${id}`,
    provider,
    externalId: id,
    title: `Product ${id}`,
    canonicalUrl: `https://example.com/${provider}/${id}`,
    price: { amountMinor: priceMinor, currency: "INR" },
    availability: "IN_STOCK",
    region: "IN",
    fetchedAt: new Date().toISOString(),
    attributes: {},
  };
}

const baseQuery: SearchQuery = {
  q: "phone",
  region: "IN",
  currency: "INR",
  categories: [],
  brands: [],
  providers: [],
  sort: "relevance",
  limit: 20,
  offset: 0,
};

function makeProvider(
  id: string,
  impl: {
    search: (q: SearchQuery) => Promise<ProductListing[]>;
    state?: "VERIFIED" | "CONFIGURED" | "NOT_CONFIGURED" | "ACCESS_PENDING" | "ERROR";
  }
): ProductProvider {
  return {
    id,
    label: id,
    getStatus: () => ({
      id,
      label: id,
      state: impl.state ?? "CONFIGURED",
      capabilities: {
        search: true,
        productDetails: false,
        checkout: [],
        supportedCurrencies: ["INR"],
        markets: ["IN"],
      },
      message: "test",
    }),
    search: impl.search,
  };
}

describe("aggregateSearch", () => {
  beforeEach(() => {
    clearSearchCache();
  });

  test("merges results and sorts by price", async () => {
    const a = makeProvider("prov-a", { search: async () => [fakeListing("1", "prov-a", 500), fakeListing("2", "prov-a", 300)] });
    const b = makeProvider("prov-b", { search: async () => [fakeListing("3", "prov-b", 400)] });
    registerProvider(a);
    registerProvider(b);
    const result = await aggregateSearch({ ...baseQuery, sort: "price_asc" }, ["prov-a", "prov-b"], { cache: false });
    expect(result.listings).toHaveLength(3);
    expect(result.listings.map((l) => l.price.amountMinor)).toEqual([300, 400, 500]);
    expect(result.outcomes.every((o) => o.ok)).toBe(true);
    expect(result.partial).toBe(false);
  });

  test("isolates provider failures into partial results", async () => {
    const ok = makeProvider("prov-ok", { search: async () => [fakeListing("1", "prov-ok", 100)] });
    const bad = makeProvider("prov-bad", {
      search: async () => {
        throw new ProviderError("prov-bad", "UPSTREAM_ERROR", "boom");
      },
    });
    registerProvider(ok);
    registerProvider(bad);
    const result = await aggregateSearch(baseQuery, ["prov-ok", "prov-bad"], { cache: false });
    expect(result.listings).toHaveLength(1);
    expect(result.partial).toBe(true);
    const failure = result.outcomes.find((o) => o.provider === "prov-bad");
    expect(failure?.ok).toBe(false);
    expect(failure && "code" in failure && failure.code).toBe("UPSTREAM_ERROR");
  });

  test("skips NOT_CONFIGURED providers with structured outcome", async () => {
    const nc = makeProvider("prov-nc", { search: async () => [], state: "NOT_CONFIGURED" });
    registerProvider(nc);
    const result = await aggregateSearch(baseQuery, ["prov-nc"], { cache: false });
    expect(result.listings).toHaveLength(0);
    expect(result.stale).toBe(true);
    const outcome = result.outcomes[0];
    expect(outcome.ok).toBe(false);
    expect("code" in outcome && outcome.code).toBe("NOT_CONFIGURED");
  });

  test("filters invalid listings that fail schema validation", async () => {
    const sloppy = makeProvider("prov-sloppy", {
      search: async () => [
        fakeListing("good", "prov-sloppy", 100),
        { ...fakeListing("bad", "prov-sloppy", 200), price: { amountMinor: 1.5, currency: "INR" } },
      ],
    });
    registerProvider(sloppy);
    const result = await aggregateSearch(baseQuery, ["prov-sloppy"], { cache: false });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].externalId).toBe("good");
  });

  test("applies price filters and pagination", async () => {
    const p = makeProvider("prov-page", {
      search: async () => [
        fakeListing("1", "prov-page", 100),
        fakeListing("2", "prov-page", 200),
        fakeListing("3", "prov-page", 300),
        fakeListing("4", "prov-page", 400),
      ],
    });
    registerProvider(p);
    const filtered = await aggregateSearch(
      { ...baseQuery, maxPriceMinor: 250, sort: "price_asc" },
      ["prov-page"],
      { cache: false }
    );
    expect(filtered.listings.map((l) => l.price.amountMinor)).toEqual([100, 200]);
    const page = await aggregateSearch({ ...baseQuery, sort: "price_asc", limit: 2, offset: 2 }, ["prov-page"], { cache: false });
    expect(page.listings.map((l) => l.price.amountMinor)).toEqual([300, 400]);
  });

  test("retries retryable errors once then fails", async () => {
    let calls = 0;
    const flaky = makeProvider("prov-flaky", {
      search: async () => {
        calls++;
        throw new ProviderError("prov-flaky", "TIMEOUT", "slow");
      },
    });
    registerProvider(flaky);
    const result = await aggregateSearch(baseQuery, ["prov-flaky"], { cache: false, retries: 1, timeoutMs: 500 });
    expect(calls).toBe(2);
    expect(result.outcomes[0].ok).toBe(false);
  });

  test("non-retryable errors are not retried", async () => {
    let calls = 0;
    const denied = makeProvider("prov-denied", {
      search: async () => {
        calls++;
        throw new ProviderError("prov-denied", "ACCESS_DENIED", "nope");
      },
    });
    registerProvider(denied);
    const result = await aggregateSearch(baseQuery, ["prov-denied"], { cache: false, retries: 2 });
    expect(calls).toBe(1);
    expect(result.outcomes[0].ok).toBe(false);
  });

  test("caches successful provider results", async () => {
    let calls = 0;
    const cached = makeProvider("prov-cache", {
      search: async () => {
        calls++;
        return [fakeListing("1", "prov-cache", 100)];
      },
    });
    registerProvider(cached);
    await aggregateSearch(baseQuery, ["prov-cache"], { cache: true });
    await aggregateSearch(baseQuery, ["prov-cache"], { cache: true });
    expect(calls).toBe(1);
    const second = await aggregateSearch(baseQuery, ["prov-cache"], { cache: true });
    const outcome = second.outcomes[0];
    expect("cached" in outcome && outcome.cached).toBe(true);
  });
});

describe("currency helpers used by aggregator tests", () => {
  test("parseMoney sanity", () => {
    expect(parseMoney("1.00", "INR").amountMinor).toBe(100);
  });
});
