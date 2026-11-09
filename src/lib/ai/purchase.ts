import { z } from "zod";
import { geminiConfigured } from "@/providers/ai/gemini";
import type { PlannerProduct } from "@/lib/catalog/products";

/**
 * Grounded purchasing planner.
 *
 * The model may ONLY choose product ids from the catalog it is given, and the
 * server re-validates every id, price, quantity and budget rule before an item
 * ever reaches a plan. A malformed or invented proposal falls back to a
 * deterministic rule-based planner, so the demo always works offline.
 */

export const PurchaseItemSchema = z
  .object({
    productId: z.string().trim().min(1).max(120),
    quantity: z.number().int().min(1).max(5),
    reason: z.string().trim().min(1).max(240),
  })
  .strict();

export const PurchaseProposalSchema = z
  .object({
    reply: z.string().trim().min(1).max(1500),
    items: z.array(PurchaseItemSchema).min(1).max(8),
    reasoning: z.string().trim().max(800).default(""),
  })
  .strict();

export type PurchaseProposal = z.infer<typeof PurchaseProposalSchema>;

export type PlannerMandate = {
  name: string;
  budgetMinor: number;
  currency: string;
  maxQuantityPerItem: number;
  maxTotalItems: number;
  allowedProviders: string[];
  excludedProviders: string[];
  preferredBrands: string[];
  excludedBrands: string[];
};

export type PurchasePlanResult = {
  proposal: PurchaseProposal;
  source: "gemini" | "deterministic";
  aiError?: string;
};

const DEFAULT_MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 25_000;

function geminiEndpoint(): string {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const SYSTEM_INSTRUCTION = `You are PayPilot, an accountable purchasing agent for a digital store.

You may ONLY choose products from the CATALOG in the user message. Never invent a product, id, price, brand, or availability.

Respond with JSON matching exactly:
{"reply": string, "items": [{"productId": string, "quantity": integer 1-5, "reason": string}], "reasoning": string}

Rules:
- Respect the mandate: never exceed the budget, the per-item quantity limit, the total item limit, or the allowed/excluded brands.
- Choose the smallest set of products that satisfies the shopper's goal. If the goal is vague, choose high-value complementary products.
- Prefer items that are clearly relevant. Do not add filler.
- "reply" is 2-4 plain sentences for the shopper. "reasoning" is one short sentence.
- "reason" is one short sentence explaining why that item is included.
- Output JSON only. No markdown, no extra fields.`;

async function callGemini(
  message: string,
  mandate: PlannerMandate | null,
  products: PlannerProduct[]
): Promise<{ proposal: PurchaseProposal } | { error: string }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { error: "GEMINI_API_KEY is not set" };

  const catalog = products.map((p) => ({
    id: p.id,
    title: p.title,
    priceUSD: (p.priceMinor / 100).toFixed(2),
    category: p.category,
    tags: p.tags,
    description: p.description,
    highlights: p.highlights,
  }));

  const constraints = mandate
    ? {
        budgetUSD: (mandate.budgetMinor / 100).toFixed(2),
        currency: mandate.currency,
        maxQuantityPerItem: mandate.maxQuantityPerItem,
        maxTotalItems: mandate.maxTotalItems,
        allowedProviders: mandate.allowedProviders,
        excludedProviders: mandate.excludedProviders,
        preferredBrands: mandate.preferredBrands,
        excludedBrands: mandate.excludedBrands,
      }
    : { note: "No mandate attached. Keep the total under USD 100." };

  const userText = `Shopper goal: ${message.slice(0, 800)}

Mandate: ${JSON.stringify(constraints)}

CATALOG: ${JSON.stringify(catalog)}`;

  let res: Response;
  try {
    res = await fetch(geminiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { error: e instanceof Error ? `Gemini network error: ${e.message.slice(0, 160)}` : "Gemini network error" };
  }

  if (!res.ok) return { error: `Gemini HTTP ${res.status}` };

  let text: string | undefined;
  try {
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return { error: "Gemini returned an unreadable body" };
  }
  if (!text) return { error: "Gemini returned no text candidate" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "Gemini response was not valid JSON" };
  }

  const parsed = PurchaseProposalSchema.safeParse(json);
  if (!parsed.success) {
    return { error: `Gemini response failed schema validation (${parsed.error.issues[0]?.message ?? "unknown"})` };
  }
  return { proposal: parsed.data };
}

function tokensOf(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and", "for", "with", "under", "need", "want", "buy", "get", "some", "please", "about", "into", "that", "this"].includes(t));
}

/** Deterministic planner: keyword relevance, then price, within budget. */
export function deterministicProposal(
  message: string,
  mandate: PlannerMandate | null,
  products: PlannerProduct[]
): PurchaseProposal {
  const tokens = tokensOf(message);
  const budget = mandate?.budgetMinor ?? 10_000;
  const maxPerItem = mandate?.maxQuantityPerItem ?? 2;
  const maxTotal = mandate?.maxTotalItems ?? 8;

  const scored = products.map((product) => {
    const hay = [product.title, product.description, product.category, ...product.tags, ...product.highlights]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (product.title.toLowerCase().includes(token)) score += 4;
      else if (product.tags.some((t) => t.toLowerCase().includes(token))) score += 3;
      else if (product.category.toLowerCase().includes(token)) score += 2;
      else if (hay.includes(token)) score += 1;
    }
    return { product, score };
  });

  const relevant = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.product.priceMinor - b.product.priceMinor);
  const pool = (relevant.length > 0 ? relevant : scored.sort((a, b) => b.product.rating.value - a.product.rating.value)).map(
    (s) => s.product
  );

  const chosen: Array<{ productId: string; quantity: number; reason: string }> = [];
  let remaining = budget;
  let totalItems = 0;
  for (const product of pool) {
    if (chosen.length >= 4 || totalItems >= maxTotal) break;
    if (product.priceMinor > remaining) continue;
    const quantity = Math.min(1, maxPerItem);
    chosen.push({
      productId: product.id,
      quantity,
      reason: `Matches "${tokens.slice(0, 2).join(" ") || "your goal"}" and fits the remaining budget.`,
    });
    remaining -= product.priceMinor * quantity;
    totalItems += quantity;
    if (remaining < 900) break;
  }

  if (chosen.length === 0) {
    const cheapest = [...products].sort((a, b) => a.priceMinor - b.priceMinor)[0];
    chosen.push({
      productId: cheapest.id,
      quantity: 1,
      reason: "Lowest-priced item in the catalog so the plan stays within budget.",
    });
  }

  const subtotal = chosen.reduce((acc, it) => {
    const p = products.find((x) => x.id === it.productId);
    return acc + (p ? p.priceMinor * it.quantity : 0);
  }, 0);

  return PurchaseProposalSchema.parse({
    reply: `I put together ${chosen.length} item(s) from the PayPilot Store for ${(subtotal / 100).toFixed(
      2
    )} USD, within your ${(budget / 100).toFixed(2)} USD budget. Every item is in stock and delivered instantly after PayPal capture.`,
    items: chosen,
    reasoning:
      "Rule-based fallback planner: keyword relevance plus budget and quantity constraints. No model output was trusted.",
  });
}

export async function proposePurchase(input: {
  message: string;
  mandate: PlannerMandate | null;
  products: PlannerProduct[];
}): Promise<PurchasePlanResult> {
  if (geminiConfigured()) {
    const result = await callGemini(input.message, input.mandate, input.products);
    if ("proposal" in result) {
      return { proposal: result.proposal, source: "gemini" };
    }
    return {
      proposal: deterministicProposal(input.message, input.mandate, input.products),
      source: "deterministic",
      aiError: result.error,
    };
  }
  return {
    proposal: deterministicProposal(input.message, input.mandate, input.products),
    source: "deterministic",
  };
}
