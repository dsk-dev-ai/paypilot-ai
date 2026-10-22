import { GeminiProvider, geminiConfigured } from "./gemini";
import { DeterministicProvider } from "./deterministic";
import type { AIProvider } from "./types";
import type { ProviderStatus } from "@/lib/core/provider";

export function getAIProvider(): AIProvider {
  return geminiConfigured() ? new GeminiProvider() : new DeterministicProvider();
}

export function getAIStatus(): ProviderStatus {
  return new GeminiProvider().getStatus();
}
