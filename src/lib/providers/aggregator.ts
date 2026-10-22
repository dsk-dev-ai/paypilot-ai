import { ProductListingSchema, type ProductListing } from "@/lib/core/listing";
import { isProviderError, toProviderError } from "@/lib/core/errors";
import type {
  AggregatedSearchResult,
  ProviderSearchOutcome,
  SearchQuery,
} from "@/lib/core/provider";
import type { ProductProvider } from "./types";
import { TtlCache } from "@/lib/http/cache";

const searchCache = new TtlCache(5 * 60 * 1000);

function cacheKey(providerId: string, query: SearchQuery): string {
  return JSON.stringify([providerId, query.q, query.region, query.currency, query.categories, query.minPriceMinor, query.maxPriceMinor, query.brands, query.sort, query.limit, query.offset]);
}

export type AggregateOptions = {
  timeoutMs?: number;
  retries?: number;
  cache?: boolean;
};

async function searchWithRetry(
  provider: ProductProvider,
  query: SearchQuery,
  opts: Required<Pick<AggregateOptions, "timeoutMs" | "retries">>
): Promise<ProductListing[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const results = await provider.search(query, controller.signal);
      const validated: ProductListing[] = [];
      for (const raw of results) {
        const parsed = ProductListingSchema.safeParse(raw);
        if (parsed.success) validated.push(parsed.data);
      }
      return validated;
    } catch (e) {
      lastError = e;
      if (isProviderError(e) && !e.retryable) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw toProviderError(provider.id, lastError);
}

/**
 * Search across the given providers. Isolates failures: a single provider
 * failure yields a partial result, not an error. Skips providers whose
 * status is NOT_CONFIGURED or ACCESS_PENDING with a structured outcome.
 */
export async function aggregateSearch(
  query: SearchQuery,
  providerIds?: string[],
  opts: AggregateOptions = {}
): Promise<AggregatedSearchResult> {
  const { timeoutMs = 8000, retries = 1, cache = true } = opts;
  const { listProviders } = await import("./registry");
  const all = listProviders();
  const selected = providerIds?.length
    ? all.filter((p) => providerIds.includes(p.id))
    : all;

  const outcomes: ProviderSearchOutcome[] = [];
  const perProvider: ProductListing[][] = [];

  await Promise.all(
    selected.map(async (provider) => {
      const t0 = Date.now();
      const status = provider.getStatus();
      if (status.state === "NOT_CONFIGURED" || status.state === "ACCESS_PENDING") {
        outcomes.push({
          provider: provider.id,
          ok: false,
          code: status.state,
          message: status.message,
          ms: Date.now() - t0,
        });
        perProvider.push([]);
        return;
      }
      const key = cacheKey(provider.id, query);
      if (cache) {
        const hit = searchCache.get<ProductListing[]>(key);
        if (hit) {
          outcomes.push({ provider: provider.id, ok: true, count: hit.length, ms: Date.now() - t0, cached: true });
          perProvider.push(hit);
          return;
        }
      }
      try {
        const listings = await searchWithRetry(provider, query, { timeoutMs, retries });
        if (cache) searchCache.set(key, listings);
        outcomes.push({ provider: provider.id, ok: true, count: listings.length, ms: Date.now() - t0, cached: false });
        perProvider.push(listings);
      } catch (e) {
        const err = toProviderError(provider.id, e);
        outcomes.push({ provider: provider.id, ok: false, code: err.code, message: err.message, ms: Date.now() - t0 });
        perProvider.push([]);
      }
    })
  );

  let listings = perProvider.flat();
  const totalBeforeLimit = listings.length;

  // Provider-agnostic filters (providers also filter server-side)
  listings = listings.filter((l) => {
    if (query.minPriceMinor !== undefined && l.price.amountMinor < query.minPriceMinor) return false;
    if (query.maxPriceMinor !== undefined && l.price.amountMinor > query.maxPriceMinor) return false;
    if (query.categories.length > 0 && l.category && !query.categories.includes(l.category)) return false;
    if (query.brands.length > 0 && l.brand && !query.brands.some((b) => l.brand!.toLowerCase().includes(b.toLowerCase()))) return false;
    return true;
  });

  listings = sortListings(listings, query.sort);

  const offset = query.offset;
  const page = listings.slice(offset, offset + query.limit);

  const okOutcomes = outcomes.filter((o) => o.ok);
  const failed = outcomes.length - okOutcomes.length;

  return {
    query,
    listings: page,
    outcomes,
    partial: failed > 0 && okOutcomes.length > 0,
    stale: okOutcomes.length === 0 && outcomes.length > 0,
    totalBeforeLimit,
    searchedAt: new Date().toISOString(),
  };
}

function sortListings(listings: ProductListing[], sort: SearchQuery["sort"]): ProductListing[] {
  const copy = [...listings];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
    case "price_desc":
      return copy.sort((a, b) => b.price.amountMinor - a.price.amountMinor);
    case "rating":
      return copy.sort((a, b) => (b.rating?.value ?? -1) - (a.rating?.value ?? -1));
    case "newest":
      return copy.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
    case "relevance":
    default:
      return copy;
  }
}

export function clearSearchCache(): void {
  searchCache.clear();
}
