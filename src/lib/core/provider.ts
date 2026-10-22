import { z } from "zod";
import { SUPPORTED_CURRENCIES, type Currency } from "./money";
import { RegionCodeSchema, type RegionCode, type ProductListing } from "./listing";

export const INTEGRATION_STATES = [
  "VERIFIED",
  "CONFIGURED",
  "NOT_CONFIGURED",
  "ACCESS_PENDING",
  "ERROR",
] as const;
export type IntegrationState = (typeof INTEGRATION_STATES)[number];

/**
 * Checkout actions a provider may support. Search capability NEVER implies
 * checkout capability — a provider must declare these explicitly.
 */
export const CHECKOUT_ACTIONS = [
  "PAYPILOT_PAYPAL",
  "MERCHANT_API",
  "EXTERNAL_CHECKOUT",
  "NOT_CONFIGURED",
  "UNAVAILABLE",
] as const;
export type CheckoutAction = (typeof CHECKOUT_ACTIONS)[number];

export type ProviderCapabilities = {
  search: boolean;
  productDetails: boolean;
  checkout: CheckoutAction[];
  supportedCurrencies: Currency[];
  markets: RegionCode[];
};

export type ProviderStatus = {
  id: string;
  label: string;
  state: IntegrationState;
  capabilities: ProviderCapabilities;
  /** Safe, human-readable reason or next step (no secrets). */
  message: string;
  officialUrl?: string;
  docsUrl?: string;
  lastCheckedAt?: string;
  lastVerifiedAt?: string;
  lastError?: { code: string; message: string; at: string };
};

export const SearchSortSchema = z.enum(["relevance", "price_asc", "price_desc", "rating", "newest"]);
export type SearchSort = z.infer<typeof SearchSortSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(300),
  region: RegionCodeSchema.default("IN"),
  currency: z.enum(SUPPORTED_CURRENCIES).default("INR"),
  categories: z.array(z.string().min(1).max(100)).max(10).default([]),
  minPriceMinor: z.number().int().nonnegative().optional(),
  maxPriceMinor: z.number().int().nonnegative().optional(),
  brands: z.array(z.string().min(1).max(100)).max(20).default([]),
  providers: z.array(z.string().min(2).max(50)).max(10).default([]),
  sort: SearchSortSchema.default("relevance"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export type ProviderSearchOutcome =
  | { provider: string; ok: true; count: number; ms: number; cached: boolean }
  | { provider: string; ok: false; code: string; message: string; ms: number };

export type AggregatedSearchResult = {
  query: SearchQuery;
  listings: ProductListing[];
  outcomes: ProviderSearchOutcome[];
  partial: boolean;
  stale: boolean;
  totalBeforeLimit: number;
  searchedAt: string;
};
