import { parseMoney } from "@/lib/core/money";
import { listingId, type ProductListing, type RegionCode } from "@/lib/core/listing";
import { ProviderError } from "@/lib/core/errors";
import type { ProviderStatus, SearchQuery } from "@/lib/core/provider";
import { safeFetch } from "@/lib/http/url-guard";
import type { ProductProvider } from "./types";

/**
 * Flipkart Affiliate API adapter — official integration.
 * Docs: https://affiliate.flipkart.com/api-docs/af_overview.html
 * Auth: Fk-Affiliate-Id + Fk-Affiliate-Token headers (affiliate account required).
 * Search + product details only. Checkout is EXTERNAL_CHECKOUT (productUrl).
 * Market: India only.
 */

const API_BASE = "https://affiliate-api.flipkart.com";
let lastVerifiedAt: number | undefined;

function isConfigured(): boolean {
  return !!(process.env.FLIPKART_AFFILIATE_ID && process.env.FLIPKART_AFFILIATE_TOKEN);
}

function headers(): Record<string, string> {
  return {
    "Fk-Affiliate-Id": process.env.FLIPKART_AFFILIATE_ID ?? "",
    "Fk-Affiliate-Token": process.env.FLIPKART_AFFILIATE_TOKEN ?? "",
    Accept: "application/json",
  };
}

type PriceObj = { amount?: string; currency?: string };

type FlipkartProduct = {
  productBaseInfoV1?: {
    productId: string;
    title: string;
    imageUrl?: string;
    imageUrls?: Record<string, string>;
    productUrl: string;
    maxRetailPrice?: PriceObj;
    minSalePrice?: PriceObj;
    productBrand?: string;
    categoryPath?: string;
    rootCategory?: string;
    isInStock?: boolean;
    sellerInfo?: { name?: string; rating?: string };
    rating?: string | number;
    ratingCount?: string | number;
    quickSpec?: Record<string, string>;
    attributes?: Record<string, string>;
  };
};

function toItem(raw: FlipkartProduct, region: RegionCode): ProductListing | null {
  const p = raw.productBaseInfoV1;
  if (!p?.productId || !p.title || !p.productUrl) return null;
  const priceSrc = p.minSalePrice ?? p.maxRetailPrice;
  if (!priceSrc?.amount || !priceSrc.currency) return null;
  let price;
  try {
    price = parseMoney(priceSrc.amount, priceSrc.currency as ProductListing["price"]["currency"]);
  } catch {
    return null;
  }
  let originalPrice;
  if (p.maxRetailPrice?.amount && p.maxRetailPrice.currency && priceSrc !== p.maxRetailPrice) {
    try {
      originalPrice = parseMoney(p.maxRetailPrice.amount, p.maxRetailPrice.currency as ProductListing["price"]["currency"]);
    } catch {
      originalPrice = undefined;
    }
  }
  const ratingNum = typeof p.rating === "number" ? p.rating : Number(p.rating);
  const ratingCountNum = typeof p.ratingCount === "number" ? p.ratingCount : Number(p.ratingCount);
  return {
    id: listingId("flipkart", p.productId),
    provider: "flipkart",
    externalId: p.productId,
    title: p.title.slice(0, 500),
    canonicalUrl: p.productUrl,
    imageUrl: p.imageUrl ?? p.imageUrls?.["default"],
    price,
    originalPrice,
    availability: p.isInStock === undefined ? "UNKNOWN" : p.isInStock ? "IN_STOCK" : "OUT_OF_STOCK",
    seller: p.sellerInfo?.name,
    brand: p.productBrand,
    category: p.rootCategory ?? p.categoryPath,
    rating:
      Number.isFinite(ratingNum) && Number.isFinite(ratingCountNum)
        ? { value: Math.max(0, Math.min(5, ratingNum)), count: Math.max(0, ratingCountNum) }
        : undefined,
    attributes: {
      ...(p.quickSpec ?? {}),
      ...(p.attributes ?? {}),
    },
    region,
    fetchedAt: new Date().toISOString(),
    attribution: "Price and availability via Flipkart Affiliate API. We earn a commission on qualifying purchases.",
  };
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!isConfigured()) {
    throw new ProviderError("flipkart", "NOT_CONFIGURED", "Flipkart affiliate credentials are not set");
  }
  const res = await safeFetch(`${API_BASE}${path}`, {
    headers: headers(),
    timeoutMs: 10000,
    provider: "flipkart",
    signal,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("flipkart", "ACCESS_DENIED", `Flipkart affiliate auth failed (HTTP ${res.status})`, { status: res.status });
    }
    if (res.status === 429) {
      throw new ProviderError("flipkart", "RATE_LIMITED", "Flipkart rate limit reached", { status: 429 });
    }
    throw new ProviderError("flipkart", "UPSTREAM_ERROR", `Flipkart request failed (HTTP ${res.status})`, { status: res.status });
  }
  return (await res.json()) as T;
}

export const flipkartProvider: ProductProvider = {
  id: "flipkart",
  label: "Flipkart",

  getStatus(): ProviderStatus {
    const base: ProviderStatus = {
      id: "flipkart",
      label: "Flipkart",
      state: "NOT_CONFIGURED",
      capabilities: {
        search: true,
        productDetails: true,
        checkout: ["EXTERNAL_CHECKOUT"],
        supportedCurrencies: ["INR"],
        markets: ["IN"],
      },
      message:
        "FLIPKART_AFFILIATE_ID / FLIPKART_AFFILIATE_TOKEN are not set. Apply at affiliate.flipkart.com.",
      officialUrl: "https://www.flipkart.com/search",
      docsUrl: "https://affiliate.flipkart.com/api-docs/af_overview.html",
    };
    if (!isConfigured()) return base;
    return {
      ...base,
      state: lastVerifiedAt ? "VERIFIED" : "CONFIGURED",
      message: lastVerifiedAt
        ? "Credentials present; a live affiliate API search has succeeded. Checkout happens on Flipkart."
        : "Credentials present; affiliate API access has not been verified yet this session.",
      lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt).toISOString() : undefined,
    };
  },

  async search(query: SearchQuery, signal?: AbortSignal): Promise<ProductListing[]> {
    if (query.region !== "IN") return [];
    const resultCount = Math.min(query.limit, 20);
    const params = new URLSearchParams({
      id: process.env.FLIPKART_AFFILIATE_ID ?? "",
      query: query.q,
      resultCount: String(resultCount),
    });
    const data = await request<{ productInfoList?: FlipkartProduct[] }>(
      `/affiliate/1.0/search.json?${params.toString()}`,
      signal
    );
    const listings = (data.productInfoList ?? [])
      .map((raw) => toItem(raw, "IN"))
      .filter((x): x is ProductListing => x !== null);
    lastVerifiedAt = Date.now();
    return listings;
  },

  async getProduct(externalId: string, region: RegionCode, signal?: AbortSignal): Promise<ProductListing | null> {
    const params = new URLSearchParams({ id: externalId });
    const data = await request<FlipkartProduct>(
      `/affiliate/1.0/product.json?${params.toString()}`,
      signal
    );
    lastVerifiedAt = Date.now();
    return toItem(data, region);
  },

  officialSearchUrl(query: string): string {
    return `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  },
};
