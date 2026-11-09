import { ProviderError } from "@/lib/core/errors";
import type { RegionCode } from "@/lib/core/listing";
import type { ProductProvider } from "./types";
import { getCatalogProduct, catalogProductToListing, searchCatalog } from "@/lib/catalog/products";

/**
 * Built-in digital merchant.
 *
 * Unlike the external adapters, this store declares the `PAYPILOT_PAYPAL`
 * checkout capability because PayPilot itself is the merchant of record: the
 * PayPal Orders v2 capture funds the order and triggers instant digital
 * fulfillment. This is the closed loop the whole demo depends on.
 */
export const paypilotProvider: ProductProvider = {
  id: "paypilot",
  label: "PayPilot Store",

  getStatus() {
    return {
      id: "paypilot",
      label: "PayPilot Store",
      state: "VERIFIED",
      capabilities: {
        search: true,
        productDetails: true,
        checkout: ["PAYPILOT_PAYPAL"],
        supportedCurrencies: ["USD"],
        markets: ["US"],
      },
      message:
        "Built-in digital merchant. PayPal sandbox capture is the payment rail and delivery is generated server-side after capture.",
      officialUrl: "/store",
      docsUrl: "https://developer.paypal.com/api/rest/integration/orders-api",
    };
  },

  async search(query) {
    return searchCatalog(query);
  },

  async getProduct(externalId: string, region: RegionCode) {
    const product = getCatalogProduct(externalId);
    if (!product) throw new ProviderError("paypilot", "INVALID_RESPONSE", "Unknown PayPilot Store product");
    return catalogProductToListing(product, region);
  },
};
