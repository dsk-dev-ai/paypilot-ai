import { registerProvider, listProviders } from "./registry";
import type { ProductProvider } from "./types";

let bootstrapped = false;

/**
 * Register all concrete provider adapters. Called lazily from API routes.
 * An adapter being registered does NOT mean it is integrated — each adapter
 * reports its own NOT_CONFIGURED/CONFIGURED/VERIFIED state via getStatus().
 */
export async function ensureProvidersRegistered(): Promise<ProductProvider[]> {
  if (!bootstrapped) {
    const { flipkartProvider } = await import("./flipkart");
    const { ebayProvider } = await import("./ebay");
    const { amazonProvider } = await import("./amazon");
    for (const p of [flipkartProvider, ebayProvider, amazonProvider]) {
      if (!listProviders().some((x) => x.id === p.id)) {
        registerProvider(p);
      }
    }
    bootstrapped = true;
  }
  return listProviders();
}

export { registerProvider, getProvider, listProviders, listProviderStatuses } from "./registry";
export type { ProductProvider } from "./types";
export { aggregateSearch } from "./aggregator";
