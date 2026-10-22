import { describe, test, expect } from "vitest";
import { ProductListingSchema, listingId } from "@/lib/core/listing";
import { SearchQuerySchema } from "@/lib/core/provider";
import { ProviderError, toProviderError } from "@/lib/core/errors";

const validListing = {
  id: "ebay:12345",
  provider: "ebay",
  externalId: "12345",
  title: "Wireless Headphones",
  canonicalUrl: "https://www.ebay.in/itm/12345",
  price: { amountMinor: 499900, currency: "INR" },
  availability: "IN_STOCK",
  region: "IN",
  fetchedAt: new Date().toISOString(),
};

describe("ProductListing schema", () => {
  test("accepts a valid listing", () => {
    expect(ProductListingSchema.safeParse(validListing).success).toBe(true);
  });

  test("rejects missing price or bad availability", () => {
    expect(ProductListingSchema.safeParse({ ...validListing, availability: "MAYBE" }).success).toBe(false);
    expect(ProductListingSchema.safeParse({ ...validListing, price: undefined }).success).toBe(false);
    expect(ProductListingSchema.safeParse({ ...validListing, canonicalUrl: "not-a-url" }).success).toBe(false);
  });

  test("rejects fractional minor units", () => {
    expect(
      ProductListingSchema.safeParse({ ...validListing, price: { amountMinor: 10.5, currency: "INR" } }).success
    ).toBe(false);
  });

  test("listingId is stable and prefixed", () => {
    expect(listingId("flipkart", "SPXyz")).toBe("flipkart:SPXyz");
  });
});

describe("SearchQuery schema", () => {
  test("applies defaults", () => {
    const r = SearchQuerySchema.safeParse({ q: "headphones" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.region).toBe("IN");
      expect(r.data.currency).toBe("INR");
      expect(r.data.sort).toBe("relevance");
      expect(r.data.limit).toBe(20);
    }
  });

  test("rejects empty query and oversized limits", () => {
    expect(SearchQuerySchema.safeParse({ q: "" }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: "x", limit: 500 }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: "x", region: "MARS" }).success).toBe(false);
  });
});

describe("ProviderError", () => {
  test("defaults retryability by code", () => {
    expect(new ProviderError("ebay", "TIMEOUT", "t").retryable).toBe(true);
    expect(new ProviderError("ebay", "NOT_CONFIGURED", "x").retryable).toBe(false);
  });

  test("toProviderError never leaks non-Error values", () => {
    const e = toProviderError("flipkart", "secret-token-leak");
    expect(e.code).toBe("UPSTREAM_ERROR");
    expect(e.message).not.toContain("secret-token-leak");
  });

  test("wraps AbortError as TIMEOUT", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(toProviderError("ebay", abort).code).toBe("TIMEOUT");
  });
});
