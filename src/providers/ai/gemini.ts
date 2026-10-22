import { AssistantPlanSchema, type AssistantPlan, type AssistantRequest } from "@/lib/ai/schema";
import { DeterministicProvider } from "./deterministic";
import type { AIProvider } from "./types";
import type { ProviderStatus } from "@/lib/core/provider";

const DEFAULT_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL}:generateContent`;
const TIMEOUT_MS = 25_000;

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key && key.length > 10 ? key : null;
}

export function geminiConfigured(): boolean {
  return apiKey() !== null;
}

let lastVerifiedAt: string | null = null;
let lastError: ProviderStatus["lastError"] = undefined;

const SYSTEM_INSTRUCTION = `You are Mandate's shopping assistant. You convert a shopper's request into at most 3 search queries for REAL product providers (eBay, Flipkart, etc.).

STRICT RULES:
- You NEVER return product listings, prices, brands-in-stock, availability, or product IDs. You only return search queries.
- Never invent product names as facts; describe search intents.
- Budgets: convert to minor units (cents/paise): "under 20000" INR → maxPriceMinor 2000000.
- Keep each query under 100 characters, focused, and likely to match real catalog titles.
- reply: 1-3 sentences, plain language, no markdown.
- reasoning: one short sentence.

Respond with JSON matching exactly:
{"reply": string, "searches": [{"q": string, "region"?: "IN"|"US"|"UK"|"EU", "minPriceMinor"?: number, "maxPriceMinor"?: number, "maxResults"?: number}], "reasoning": string}
No other fields.`;

export class GeminiProvider implements AIProvider {
  id = "gemini";
  private fallback = new DeterministicProvider();

  getStatus(): ProviderStatus {
    const configured = geminiConfigured();
    return {
      id: "ai-gemini",
      label: "Gemini assistant",
      state: configured ? (lastVerifiedAt ? "VERIFIED" : "CONFIGURED") : "NOT_CONFIGURED",
      capabilities: {
        search: false,
        productDetails: false,
        checkout: [],
        supportedCurrencies: [],
        markets: [],
      },
      message: configured
        ? lastVerifiedAt
          ? `Gemini responded successfully (last verified ${lastVerifiedAt}). Output is schema-validated; invented listings are rejected.`
          : "GEMINI_API_KEY is set. State becomes VERIFIED after the first schema-valid response."
        : "GEMINI_API_KEY is not set. The assistant runs on the offline rule-based fallback.",
      docsUrl: "https://ai.google.dev/gemini-api/docs",
      lastVerifiedAt: lastVerifiedAt ?? undefined,
      lastError: lastError ?? undefined,
    };
  }

  async plan(req: AssistantRequest): Promise<AssistantPlan> {
    const key = apiKey();
    if (!key) return this.fallback.plan(req);
    try {
      const res = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Shopper message: ${req.message.slice(0, 800)}\n` +
                    (req.budgetMinor != null ? `Budget: ${req.budgetMinor} ${req.currency ?? "INR"} minor units.\n` : "") +
                    (req.region ? `Region: ${req.region}\n` : ""),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = { code: "GEMINI_HTTP", message: `Gemini API HTTP ${res.status}`, at: new Date().toISOString() };
        return this.fallback.plan(req);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = { code: "GEMINI_EMPTY", message: "Gemini returned no text candidate", at: new Date().toISOString() };
        return this.fallback.plan(req);
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = { code: "GEMINI_PARSE", message: "Gemini response was not valid JSON", at: new Date().toISOString() };
        return this.fallback.plan(req);
      }
      // Strict parse: extra keys or invented fields throw → fallback.
      const parsed = AssistantPlanSchema.safeParse(json);
      if (!parsed.success) {
        lastError = {
          code: "GEMINI_SCHEMA",
          message: `Gemini response failed schema validation (${parsed.error.issues[0]?.message ?? "unknown"})`,
          at: new Date().toISOString(),
        };
        return this.fallback.plan(req);
      }
      lastVerifiedAt = new Date().toISOString();
      lastError = undefined;
      return parsed.data;
    } catch (e) {
      lastError = {
        code: "GEMINI_TIMEOUT_OR_NETWORK",
        message: e instanceof Error ? e.message.slice(0, 200) : "Gemini request failed",
        at: new Date().toISOString(),
      };
      return this.fallback.plan(req);
    }
  }
}

/** Test hook */
export function __resetGeminiState(): void {
  lastVerifiedAt = null;
  lastError = undefined;
}
