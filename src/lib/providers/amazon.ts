import type { ProviderStatus } from "@/lib/core/provider";
import type { ProductProvider } from "./types";
import { ProviderError } from "@/lib/core/errors";

/**
 * Amazon Associates (India) — honest external-link provider.
 * Amazon Associates does not offer an official public product-search API.
 * Per policy, Mandate does not scrape amazon.in. This provider never
 * returns listings; it offers a safe official search link only.
 */
export const amazonProvider: ProductProvider = {
  id: "amazon",
  label: "Amazon India",

  getStatus(): ProviderStatus {
    return {
      id: "amazon",
      label: "Amazon India",
      state: "NOT_CONFIGURED",
      capabilities: {
        search: false,
        productDetails: false,
        checkout: ["EXTERNAL_CHECKOUT"],
        supportedCurrencies: ["INR"],
        markets: ["IN"],
      },
      message:
        "Amazon Associates does not provide an official product-search API. Mandate links to amazon.in search results only — it never scrapes or automates Amazon.",
      officialUrl: "https://www.amazon.in",
      docsUrl: "https://affiliate-program.amazon.in/",
    };
  },

  async search(): Promise<never[]> {
    throw new ProviderError(
      "amazon",
      "NOT_CONFIGURED",
      "Amazon has no official product-search API; use the official amazon.in link instead"
    );
  },

  officialSearchUrl(query: string): string {
    return `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  },
};
