import type { ProductListing, RegionCode } from "@/lib/core/listing";
import type { ProviderStatus, SearchQuery } from "@/lib/core/provider";

export interface ProductProvider {
  readonly id: string;
  readonly label: string;
  /** Compute current integration status from environment (never throws). */
  getStatus(): ProviderStatus;
  /**
   * Search products. Implementations must throw ProviderError when the
   * provider is unavailable; the aggregator isolates failures.
   * Search NEVER implies checkout capability.
   */
  search(query: SearchQuery, signal?: AbortSignal): Promise<ProductListing[]>;
  /** Optional product details lookup. */
  getProduct?(externalId: string, region: RegionCode, signal?: AbortSignal): Promise<ProductListing | null>;
  /** Safe official external search URL shown when the provider is not configured. */
  officialSearchUrl?(query: string, region: RegionCode): string | undefined;
}
