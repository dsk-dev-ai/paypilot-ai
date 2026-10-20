import type { AIPlanRequest, AIPlanResponse } from "./types";

export class GeminiProvider {
  name = "gemini" as const;
  isConfigured() {
    const k = process.env.GEMINI_API_KEY;
    return !!k && k.length > 0;
  }
  async plan(req: AIPlanRequest, catalog: Array<{id:string;name:string;price:number}>): Promise<AIPlanResponse> {
    if (!this.isConfigured()) throw new Error("Gemini not configured");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    // Minimal implementation - requires fetch; structure present for extension
    return { items: [], source: "gemini" };
  }
}
