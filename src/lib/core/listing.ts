import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./money";

export const AVAILABILITY_VALUES = [
  "IN_STOCK",
  "LIMITED_STOCK",
  "OUT_OF_STOCK",
  "UNKNOWN",
] as const;
export type Availability = (typeof AVAILABILITY_VALUES)[number];

export const RegionCodeSchema = z.enum(["IN", "US", "UK", "EU"]);
export type RegionCode = z.infer<typeof RegionCodeSchema>;

export const MoneySchema = z.object({
  amountMinor: z.number().int().safe(),
  currency: z.enum(SUPPORTED_CURRENCIES),
});

/** Only http(s) URLs are allowed anywhere a user can be redirected. */
const SafeHttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "URL must use http or https");

export const ProductListingSchema = z.object({
  id: z.string().min(3).max(200),
  provider: z.string().min(2).max(50),
  externalId: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  canonicalUrl: SafeHttpUrlSchema,
  imageUrl: SafeHttpUrlSchema.optional(),
  price: MoneySchema,
  originalPrice: MoneySchema.optional(),
  availability: z.enum(AVAILABILITY_VALUES),
  seller: z.string().max(200).optional(),
  brand: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  rating: z
    .object({
      value: z.number().min(0).max(5),
      count: z.number().int().nonnegative(),
    })
    .optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  region: RegionCodeSchema,
  fetchedAt: z.string().datetime(),
  /** Human-readable attribution / affiliate disclosure required by the provider. */
  attribution: z.string().max(300).optional(),
});

export type ProductListing = z.infer<typeof ProductListingSchema>;

/** Stable listing id: `${provider}:${externalId}`. */
export function listingId(provider: string, externalId: string): string {
  return `${provider}:${externalId}`;
}
