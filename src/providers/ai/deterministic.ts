import { AssistantPlanSchema, type AssistantPlan, type AssistantRequest } from "@/lib/ai/schema";
import type { AIProvider } from "./types";
import type { ProviderStatus } from "@/lib/core/provider";

const CURRENCY_SYMBOLS: Record<string, string> = { "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP" };

/**
 * Rule-based fallback: extracts budget hints and category keywords from the
 * user's message. Deterministic, offline, and incapable of inventing
 * listings — it only produces search queries.
 */
export function parseBudgetMinor(message: string): { budgetMinor?: number; currency: string } {
  let currency = "INR";
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (message.includes(sym)) currency = code;
  }
  if (/\busd\b|\bdollars?\b/i.test(message)) currency = "USD";
  if (/\beur\b|\beuros?\b/i.test(message)) currency = "EUR";
  if (/\bgbp\b|\bpounds?\b/i.test(message)) currency = "GBP";
  if (/\binr\b|\brupees?\b/i.test(message)) currency = "INR";

  const under = message.match(/(?:under|below|within|less than|max(?:imum)?|upto|up to)\s*(?:₹|rs\.?|inr|[$€£]|\$)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|l|k)?/i);
  const budgetNum = under ? Number(under[1].replace(/,/g, "")) : NaN;
  if (Number.isFinite(budgetNum) && budgetNum > 0) {
    let minor = Math.round(budgetNum * 100);
    const suffix = (under?.[2] ?? "").toLowerCase();
    if (suffix === "k" || suffix === "thousand") minor = Math.round(budgetNum * 1000 * 100);
    if (suffix === "l" || suffix === "lakh") minor = Math.round(budgetNum * 100000 * 100);
    return { budgetMinor: minor, currency };
  }
  return { currency };
}

/** Strip filler words to leave the product core of a query. */
export function coreQuery(message: string): string {
  return message
    .replace(/(?:under|below|within|less than|max(?:imum)?|upto|up to)\s*(?:₹|rs\.?|inr|[$€£]|\$)?\s*[\d,]+(?:\.\d+)?\s*(k|thousand|lakh|l)?/gi, " ")
    .replace(/\b(i|need|want|buy|get|purchase|to|search|find|please|show|me|for|a|an|the|some|good|best|cheap|affordable|top[- ]rated)\b/gi, " ")
    .replace(/[₹$€£]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const GIFT_INTENT = /\b(gift|gifts|present|presents|party|birthday|recipient|recipients|give|giving|repay|thank)\b/i;
const AGE_RANGE = /\b(\d{2})\s*[-–to]{1,3}\s*(\d{2})\b/;
const GENDER_TEEN_GIRL = /\b(girl|girls|female|women|woman|teen|teenage|teenager)\b/i;
const GENDER_TEEN_BOY = /\b(boy|boys|male|men|man|guy|guys)\b/i;

/**
 * Intent-aware query expansion. The assistant may only emit SEARCH QUERIES, so
 * for vague gift requests we turn them into focused, catalog-friendly queries
 * rather than passing the raw sentence through (which matches nothing).
 */
export function deriveQueries(message: string): string[] {
  const q: string[] = [];
  const core = coreQuery(message);
  const hasGift = GIFT_INTENT.test(message);
  const age = message.match(AGE_RANGE);
  const isTeen = age ? Number(age[2]) <= 21 || Number(age[1]) <= 20 : false;

  if (hasGift) {
    const audienceBits: string[] = [];
    if (isTeen || GENDER_TEEN_GIRL.test(message) || GENDER_TEEN_BOY.test(message)) audienceBits.push("teen");
    if (GENDER_TEEN_GIRL.test(message)) audienceBits.push("girl");
    else if (GENDER_TEEN_BOY.test(message)) audienceBits.push("boy");
    const audience = audienceBits.join(" ");
    q.push(`gift for ${audience || "friends"}`.trim());
    if (audience.includes("girl")) q.push("cute gift for teen girl");
    if (audience.includes("boy")) q.push("cool gadget gift for teen boy");
    if (!audienceBits.length) q.push("unique gift under budget");
  } else if (core.length >= 3) {
    q.push(core);
  }

  if (q.length === 0) q.push(message.trim().slice(0, 120) || "deals");
  return [...new Set(q)].slice(0, 3).map((s) => s.slice(0, 120));
}

export class DeterministicProvider implements AIProvider {
  id = "deterministic";

  getStatus(): ProviderStatus {
    return {
      id: "ai-deterministic",
      label: "Rule-based assistant",
      state: "VERIFIED",
      capabilities: { search: false, productDetails: false, checkout: [], supportedCurrencies: [], markets: [] },
      message:
        "Always available offline fallback. Understands budget phrases like 'under 20000' and produces search queries — never invented products.",
      docsUrl: "",
    };
  }

  async plan(req: AssistantRequest): Promise<AssistantPlan> {
    const { budgetMinor, currency } = req.budgetMinor != null
      ? { budgetMinor: req.budgetMinor, currency: req.currency ?? "INR" }
      : parseBudgetMinor(req.message);
    const region = req.region ?? "IN";
    const queries = deriveQueries(req.message);
    const searches = queries.map((q) => ({
      q,
      region,
      ...(budgetMinor != null ? { maxPriceMinor: budgetMinor } : {}),
      maxResults: 10,
    }));
    const plan = AssistantPlanSchema.parse({
      reply: budgetMinor != null
        ? `Searching real provider listings for ${searches.map((s) => `"${s.q}"`).join(", ")} within ${currency} ${(budgetMinor / 100).toFixed(0)}. Results come from live provider APIs — nothing is invented.`
        : `Searching real provider listings for ${searches.map((s) => `"${s.q}"`).join(", ")}. Results come from live provider APIs — nothing is invented.`,
      searches,
      reasoning: "Rule-based fallback: budget phrase, gift intent, and keyword extraction (no LLM available or AI request invalid).",
    });
    return plan;
  }
}
