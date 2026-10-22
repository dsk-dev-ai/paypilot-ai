import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { ebayProvider, __resetEbayState } from "@/lib/providers/ebay";
import { flipkartProvider } from "@/lib/providers/flipkart";
import { amazonProvider } from "@/lib/providers/amazon";
import { ProviderError } from "@/lib/core/errors";
import type { SearchQuery } from "@/lib/core/provider";

const query: SearchQuery = {
  q: "headphones",
  region: "IN",
  currency: "INR",
  categories: [],
  brands: [],
  providers: [],
  sort: "relevance",
  limit: 10,
  offset: 0,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("eBay Browse adapter", () => {
  beforeEach(() => {
    __resetEbayState();
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
  });

  test("reports NOT_CONFIGURED without credentials", () => {
    const status = ebayProvider.getStatus();
    expect(status.state).toBe("NOT_CONFIGURED");
    expect(status.capabilities.search).toBe(true);
    expect(status.capabilities.checkout).toEqual(["EXTERNAL_CHECKOUT"]);
  });

  test("search throws NOT_CONFIGURED without credentials (no fake results)", async () => {
    await expect(ebayProvider.search(query)).rejects.toThrow(/NOT_CONFIGURED|credentials/);
  });

  test("maps real Browse API response shape to ProductListing", async () => {
    process.env.EBAY_CLIENT_ID = "test-id";
    process.env.EBAY_CLIENT_SECRET = "test-secret";
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/identity/v1/oauth2/token")) {
        return jsonResponse({ access_token: "tok-123", expires_in: 3600 });
      }
      if (u.includes("/buy/browse/v1/item_summary/search")) {
        return jsonResponse({
          itemSummaries: [
            {
              itemId: "v1|123456789|0",
              title: "Sony WH-1000XM5 Headphones",
              image: { imageUrl: "https://i.ebayimg.com/x.jpg" },
              price: { value: "24990.00", currency: "INR" },
              itemWebUrl: "https://www.ebay.in/itm/123456789",
              seller: { username: "audio_store" },
              categories: [{ categoryName: "Consumer Electronics" }],
              rating: { average: 4.7, count: 1234 },
              buyingOptions: ["FIXED_PRICE"],
              itemCondition: "New",
            },
            {
              itemId: "v1|bad|0",
              title: "Missing price item",
              itemWebUrl: "https://www.ebay.in/itm/bad",
            },
          ],
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const listings = await ebayProvider.search(query);
    expect(listings).toHaveLength(1);
    const l = listings[0];
    expect(l.id).toBe("ebay:v1|123456789|0");
    expect(l.price).toEqual({ amountMinor: 2499000, currency: "INR" });
    expect(l.seller).toBe("audio_store");
    expect(l.rating?.value).toBe(4.7);
    expect(l.canonicalUrl).toBe("https://www.ebay.in/itm/123456789");
    expect(l.attribution).toBeTruthy();
    expect(ebayProvider.getStatus().state).toBe("VERIFIED");
  });

  test("raises ACCESS_DENIED on OAuth rejection", async () => {
    process.env.EBAY_CLIENT_ID = "bad";
    process.env.EBAY_CLIENT_SECRET = "bad";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 401)));
    await expect(ebayProvider.search(query)).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });

  test("raises RATE_LIMITED on 429", async () => {
    process.env.EBAY_CLIENT_ID = "ok";
    process.env.EBAY_CLIENT_SECRET = "ok";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).includes("oauth2/token")) return jsonResponse({ access_token: "t", expires_in: 3600 });
        return jsonResponse({}, 429);
      })
    );
    await expect(ebayProvider.search(query)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("Flipkart affiliate adapter", () => {
  beforeEach(() => {
    delete process.env.FLIPKART_AFFILIATE_ID;
    delete process.env.FLIPKART_AFFILIATE_TOKEN;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.FLIPKART_AFFILIATE_ID;
    delete process.env.FLIPKART_AFFILIATE_TOKEN;
  });

  test("reports NOT_CONFIGURED with application guidance", () => {
    const status = flipkartProvider.getStatus();
    expect(status.state).toBe("NOT_CONFIGURED");
    expect(status.message).toMatch(/affiliate\.flipkart\.com/);
  });

  test("maps affiliate API response to ProductListing with attribution", async () => {
    process.env.FLIPKART_AFFILIATE_ID = "aff-1";
    process.env.FLIPKART_AFFILIATE_TOKEN = "tok";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(String(url)).toContain("/affiliate/1.0/search.json");
        expect((init?.headers as Record<string, string>)["Fk-Affiliate-Id"]).toBe("aff-1");
        return jsonResponse({
          productInfoList: [
            {
              productBaseInfoV1: {
                productId: "SPMobGDDHFHZZZGH",
                title: "Motorola Edge 50 Fusion",
                imageUrl: "https://rukminim1.example/img.jpg",
                productUrl: "https://www.flipkart.com/motorola-edge/p/itm1",
                maxRetailPrice: { amount: "25999.000000", currency: "INR" },
                minSalePrice: { amount: "20999.000000", currency: "INR" },
                productBrand: "Motorola",
                rootCategory: "Mobiles",
                isInStock: true,
                sellerInfo: { name: "RetailNet" },
                rating: "4.4",
                ratingCount: "12345",
                quickSpec: { RAM: "8 GB", Storage: "128 GB" },
              },
            },
          ],
        });
      })
    );
    const listings = await flipkartProvider.search(query);
    expect(listings).toHaveLength(1);
    const l = listings[0];
    expect(l.price.amountMinor).toBe(2099900);
    expect(l.originalPrice?.amountMinor).toBe(2599900);
    expect(l.brand).toBe("Motorola");
    expect(l.availability).toBe("IN_STOCK");
    expect(l.attributes.RAM).toBe("8 GB");
    expect(l.attribution).toMatch(/commission/);
  });

  test("non-IN region returns empty (market coverage honesty)", async () => {
    process.env.FLIPKART_AFFILIATE_ID = "aff-1";
    process.env.FLIPKART_AFFILIATE_TOKEN = "tok";
    expect(await flipkartProvider.search({ ...query, region: "US" })).toEqual([]);
  });
});

describe("Amazon adapter", () => {
  test("always NOT_CONFIGURED, never returns listings, offers official link", async () => {
    const status = amazonProvider.getStatus();
    expect(status.state).toBe("NOT_CONFIGURED");
    expect(status.capabilities.search).toBe(false);
    await expect(amazonProvider.search(query)).rejects.toBeInstanceOf(ProviderError);
    expect(amazonProvider.officialSearchUrl!("running shoes", "IN")).toBe(
      "https://www.amazon.in/s?k=running%20shoes"
    );
  });
});
