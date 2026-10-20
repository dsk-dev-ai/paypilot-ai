import { DeterministicProvider } from "./deterministic";
import { GeminiProvider } from "./gemini";

export function getAIProvider() {
  const gem = new GeminiProvider();
  if (gem.isConfigured()) return gem;
  return new DeterministicProvider();
}
