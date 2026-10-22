import type { ProductProvider } from "./types";
import type { ProviderStatus } from "@/lib/core/provider";

const providers = new Map<string, ProductProvider>();

export function registerProvider(provider: ProductProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): ProductProvider | undefined {
  return providers.get(id);
}

export function listProviders(): ProductProvider[] {
  return Array.from(providers.values());
}

export function listProviderStatuses(): ProviderStatus[] {
  return listProviders().map((p) => p.getStatus());
}
