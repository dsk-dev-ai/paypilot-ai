import type { OrderItem } from "@/modules/orders/types";

export type AIPlanRequest = {
  query: string;
  budget: number;
  currency?: "USD";
  allowedProductIds?: string[];
};

export type AIPlanItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type AIPlanResponse = {
  items: AIPlanItem[];
  rationale?: string;
  source: "gemini" | "groq" | "deterministic";
};

export interface AIProvider {
  name: "gemini" | "groq" | "deterministic";
  isConfigured(): boolean;
  plan(request: AIPlanRequest, catalog: Array<{id:string;name:string;price:number}>): Promise<AIPlanResponse>;
}
