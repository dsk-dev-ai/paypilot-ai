import { z } from "zod";
import { RegionCodeSchema, type RegionCode } from "@/lib/core/listing";

/**
 * The ONLY shape the AI is allowed to produce. The assistant NEVER returns
 * listings, prices, or product IDs — it returns search intents. Every listing
 * shown to the user comes from real provider APIs (or is honestly labeled).
 * Strict mode: any extra field (e.g. hallucinated "items") fails validation
 * and the request falls back to the deterministic provider.
 */
export const AssistantSearchSchema = z
  .object({
    q: z.string().trim().min(2).max(120),
    region: RegionCodeSchema.default("IN"),
    minPriceMinor: z.number().int().nonnegative().max(100_000_000).optional(),
    maxPriceMinor: z.number().int().nonnegative().max(100_000_000).optional(),
    maxResults: z.number().int().min(1).max(20).default(8),
  })
  .strict();

export const AssistantPlanSchema = z
  .object({
    reply: z.string().trim().min(1).max(1200),
    searches: z.array(AssistantSearchSchema).min(1).max(3),
    reasoning: z.string().trim().max(600).default(""),
  })
  .strict();

export type AssistantSearch = z.infer<typeof AssistantSearchSchema>;
export type AssistantPlan = z.infer<typeof AssistantPlanSchema>;

export type AssistantRequest = {
  message: string;
  budgetMinor?: number;
  currency?: string;
  region?: RegionCode;
};
