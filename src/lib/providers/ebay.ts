import { parseMoney } from "@/lib/core/money";
import { listingId, type ProductListing, type RegionCode } from "@/lib/core/listing";
import { ProviderError } from "@/lib/core/errors";
import type { ProviderStatus, SearchQuery } from "@/lib/core/provider";
import { safeFetch } from "@/lib/http/url-guard";
import { TtlCache } from "@/lib/http/cache";
import type { ProductProvider } from "./types";

/**
 * eBay Buy Browse API adapter — official integration.
 * Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 * Auth: OAuth client_credentials with the Browse API scope.
 * Search only. Direct checkout requires separate Buy Checkout API approval,
 * therefore checkout capability is EXTERNAL_CHECKOUT (official listing URL).
 */

const API_BASE = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";
const tokenCache = new TtlCache(50 * 60 * 1000);

/** Test hook: clear cached OAuth token and verification state. */
export function __resetEbayState(): void {
  tokenCache.clear();
  lastVerifiedAt = undefined;
}

let lastVerifiedAt: number | undefined;

function isConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

function marketplaceFor(region: RegionCode): string {
  switch (region) {
    case "IN":
      return "EBAY_IN";
    case "US":
      return "EBAY_US";
    case "UK":
      return "EBAY_GB";
    case "EU":
      return "EBAY_DE";
  }
}

async function getAccessToken(signal?: AbortSignal): Promise<string> {
  const cached = tokenCache.get<string>("ebay_token");
  if (cached) return cached;
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ProviderError("ebay", "NOT_CONFIGURED", "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set");
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await safeFetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`,
    timeoutMs: 10000,
    provider: "ebay",
  }).catch((e: unknown) => {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("ebay", "NETWORK", "Token request failed");
  });
  if (signal?.aborted) throw new ProviderError("ebay", "TIMEOUT", "Aborted");
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("ebay", "ACCESS_DENIED", `eBay OAuth rejected credentials (HTTP ${res.status})`, { status: res.status });
    }
    throw new ProviderError("ebay", "UPSTREAM_ERROR", `eBay OAuth failed (HTTP ${res.status})`, { status: res.status });
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set("ebay_token", data.access_token, Math.min(data.expires_in - 60, 50) * 60 * 1000);
  return data.access_token;
}

type EbayItemSummary = {
  itemId: string;
  title: string;
  image?: { imageUrl: string };
  price?: { value: string; currency: string };
  itemWebUrl: string;
  categories?: Array<{ categoryName: string }>;
  seller?: { username: string };
  rating?: { average: number; count: number };
  buyingOptions?: string[];
  itemCondition?: string;
};

function toItem(raw: EbayItemSummary, region: RegionCode): ProductListing | null {
  if (!raw.itemId || !raw.title || !raw.price?.value || !raw.itemWebUrl) return null;
  let price;
  try {
    price = parseMoney(raw.price.value, raw.price.currency as ProductListing["price"]["currency"]);
  } catch {
    return null;
  }
  const externalId = raw.itemId;
  return {
    id: listingId("ebay", externalId),
    provider: "ebay",
    externalId,
    title: raw.title.slice(0, 500),
    canonicalUrl: raw.itemWebUrl,
    imageUrl: raw.image?.imageUrl,
    price,
    availability: raw.buyingOptions?.length ? "IN_STOCK" : "UNKNOWN",
    seller: raw.seller?.username,
    category: raw.categories?.[0]?.categoryName,
    rating: raw.rating ? { value: raw.rating.average, count: raw.rating.count } : undefined,
    attributes: raw.itemCondition ? { condition: raw.itemCondition } : {},
    region,
    fetchedAt: new Date().toISOString(),
    attribution: "Price and availability from eBay Browse API; checkout completes on ebay.",
  };
}

export const ebayProvider: ProductProvider = {
  id: "ebay",
  label: "eBay",

  getStatus(): ProviderStatus {
    const base: ProviderStatus = {
      id: "ebay",
      label: "eBay",
      state: "NOT_CONFIGURED",
      capabilities: {
        search: true,
        productDetails: true,
        checkout: ["EXTERNAL_CHECKOUT"],
        supportedCurrencies: ["USD", "INR", "EUR", "GBP"],
        markets: ["IN", "US", "UK", "EU"],
      },
      message: "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not set. eBay search is disabled.",
      officialUrl: "https://www.ebay.com/sch/i.html",
      docsUrl: "https://developer.ebay.com/api-docs/buy/browse/overview.html",
    };
    if (!isConfigured()) return base;
    return {
      ...base,
      state: lastVerifiedAt ? "VERIFIED" : "CONFIGURED",
      message: lastVerifiedAt
        ? "Credentials present; a live Browse API search has succeeded. Checkout happens on eBay (EXTERNAL_CHECKOUT)."
        : "Credentials present; Browse API search has not been verified yet this session.",
      lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : undefined,
    };
  },

  async search(query: SearchQuery, signal?: AbortSignal): Promise<ProductListing[]> {
    if (!isConfigured()) {
      throw new ProviderError("ebay", "NOT_CONFIGURED", "eBay credentials are not set");
    }
    const token = await getAccessToken(signal);
    const params = new URLSearchParams({
      q: query.q,
      limit: String(Math.min(query.limit, 50)),
      marketplace_id: marketplaceFor(query.region),
    });
    if (query.offset > 0) params.set("offset", String(query.offset));
    const filters: string[] = [];
    if (query.minPriceMinor !== undefined || query.maxPriceMinor !== undefined) {
      const min = ((query.minPriceMinor ?? 0) / 100).toFixed(2);
      const max = query.maxPriceMinor !== undefined ? (query.maxPriceMinor / 100).toFixed(2) : "*";
      filters.push(`price:[${min}..${max}]`);
    }
    if (filters.length) params.set("filter", filters.join(","));

    const res = await safeFetch(`${API_BASE}/buy/browse/v1/item_summary/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": marketplaceFor(query.region),
      },
      timeoutMs: 10000,
      provider: "ebay",
      signal,
    });
    if (!res.ok) {
      if (res.status === 429) throw new ProviderError("ebay", "RATE_LIMITED", "eBay rate limit reached", { status: 429 });
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError("ebay", "ACCESS_DENIED", `eBay API access denied (HTTP ${res.status})`, { status: res.status });
      }
      throw new ProviderError("ebay", "UPSTREAM_ERROR", `eBay search failed (HTTP ${res.status})`, { status: res.status });
    }
    const data = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    const listings = (data.itemSummaries ?? [])
      .map((raw) => toItem(raw, query.region))
      .filter((x): x is ProductListing => x !== null);
    lastVerifiedAt = Date.now();
    return listings;
  },

  async getProduct(externalId: string, region: RegionCode, signal?: AbortSignal): Promise<ProductListing | null> {
    if (!isConfigured()) {
      throw new ProviderError("ebay", "NOT_CONFIGURED", "eBay credentials are not set");
    }
    const token = await getAccessToken(signal);
    const res = await safeFetch(`${API_BASE}/buy/browse/v1/item/get_item?item_id=${encodeURIComponent(externalId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": marketplaceFor(region),
      },
      timeoutMs: 10000,
      provider: "ebay",
      signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ProviderError("ebay", "UPSTREAM_ERROR", `eBay item lookup failed (HTTP ${res.status})`, { status: res.status });
    }
    const raw = (await res.json()) as EbayItemSummary;
    lastVerifiedAt = Date.now();
    return toItem(raw, region);
  },

  officialSearchUrl(query: string): string {
    return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
  },
};
