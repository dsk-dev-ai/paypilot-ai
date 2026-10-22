import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { AssistantPlanSchema } from "@/lib/ai/schema";
import { DeterministicProvider, parseBudgetMinor, coreQuery } from "@/providers/ai/deterministic";
import { GeminiProvider, __resetGeminiState } from "@/providers/ai/gemini";

beforeEach(() => {
  vi.unstubAllEnvs();
  __resetGeminiState();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("budget parsing (deterministic)", () => {
  test("under 20000 INR → 2000000 minor", () => {
    expect(parseBudgetMinor("headphones under 20000")).toEqual({ budgetMinor: 2000000, currency: "INR" });
  });

  test("under 5k → 500000 minor", () => {
    expect(parseBudgetMinor("mouse under 5k").budgetMinor).toBe(500000);
  });

  test("under 2 lakh → 20000000 minor", () => {
    expect(parseBudgetMinor("phone under 2 lakh").budgetMinor).toBe(20000000);
  });

  test("$100 budget → USD", () => {
    const r = parseBudgetMinor("keyboard under $100");
    expect(r).toEqual({ budgetMinor: 10000, currency: "USD" });
  });

  test("₹1,500 with comma", () => {
    expect(parseBudgetMinor("case under ₹1,500").budgetMinor).toBe(150000);
  });

  test("no budget phrase → no budget", () => {
    expect(parseBudgetMinor("show me laptops").budgetMinor).toBeUndefined();
  });
});

describe("coreQuery", () => {
  test("strips budget and filler words", () => {
    expect(coreQuery("i want to buy wireless headphones under 20000")).toBe("wireless headphones");
  });
});

describe("DeterministicProvider", () => {
  test("produces a schema-valid plan with a real search query", async () => {
    const p = new DeterministicProvider();
    const plan = await p.plan({ message: "noise cancelling headphones under 20000", region: "IN" });
    expect(plan.searches).toHaveLength(1);
    expect(plan.searches[0].q).toContain("headphones");
    expect(plan.searches[0].maxPriceMinor).toBe(2000000);
    expect(plan.reply).toContain("real provider");
    expect(p.getStatus().state).toBe("VERIFIED");
  });

  test("never returns listings or product ids", async () => {
    const p = new DeterministicProvider();
    const plan = await p.plan({ message: "gaming laptop" });
    expect(Object.keys(plan)).toEqual(["reply", "searches", "reasoning"]);
  });
});

describe("AssistantPlanSchema is strict", () => {
  test("rejects invented listings embedded by an AI model", () => {
    const bad = {
      reply: "Here are products",
      searches: [{ q: "laptop", maxResults: 5 }],
      reasoning: "",
      items: [{ productId: "fake-123", price: 999 }],
    };
    expect(AssistantPlanSchema.safeParse(bad).success).toBe(false);
  });

  test("rejects missing searches", () => {
    expect(AssistantPlanSchema.safeParse({ reply: "hi", searches: [], reasoning: "" }).success).toBe(false);
  });

  test("accepts a minimal valid plan", () => {
    const ok = AssistantPlanSchema.parse({
      reply: "Searching now.",
      searches: [{ q: "office chair", region: "IN", maxResults: 5 }],
      reasoning: "category extraction",
    });
    expect(ok.searches[0].region).toBe("IN");
  });
});

describe("GeminiProvider", () => {
  test("falls back to deterministic when GEMINI_API_KEY missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    __resetGeminiState();
    const p = new GeminiProvider();
    const plan = await p.plan({ message: "earbuds under 3000" });
    expect(plan.searches[0].maxPriceMinor).toBe(300000);
    expect(p.getStatus().state).toBe("NOT_CONFIGURED");
  });

  test("valid Gemini response is schema-checked and marks VERIFIED", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-123456");
    __resetGeminiState();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: "I'll search for that.",
                      searches: [{ q: "wireless earbuds", region: "IN", maxPriceMinor: 300000, maxResults: 8 }],
                      reasoning: "budget detected",
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const p = new GeminiProvider();
    const plan = await p.plan({ message: "earbuds under 3000" });
    expect(plan.searches[0].q).toBe("wireless earbuds");
    expect(p.getStatus().state).toBe("VERIFIED");
    const call = fetchMock.mock.calls[0] as unknown as [unknown];
    expect(String(call[0])).toContain("generativelanguage.googleapis.com");
  });

  test("invented-listing response falls back to deterministic", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-123456");
    __resetGeminiState();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        reply: "Here are products!",
                        searches: [{ q: "tv" }],
                        reasoning: "",
                        items: [{ productId: "hallucinated-1", price: 100 }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const p = new GeminiProvider();
    const plan = await p.plan({ message: "smart tv" });
    // deterministic fallback kicked in — no invented fields anywhere
    expect(Object.keys(plan)).toEqual(["reply", "searches", "reasoning"]);
    expect(p.getStatus().lastError?.code).toBe("GEMINI_SCHEMA");
    expect(p.getStatus().state).toBe("CONFIGURED");
  });

  test("Gemini HTTP error falls back silently", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key-123456");
    __resetGeminiState();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const p = new GeminiProvider();
    const plan = await p.plan({ message: "tablet under 15000" });
    expect(plan.searches[0].maxPriceMinor).toBe(1500000);
    expect(p.getStatus().lastError?.code).toBe("GEMINI_HTTP");
  });
});
