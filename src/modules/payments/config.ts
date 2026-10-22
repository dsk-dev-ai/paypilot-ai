import type { ProviderStatus } from "@/lib/core/provider";

/** Currencies Mandate's PayPal integration is allowed to charge. */
export const PAYPAL_SUPPORTED_CURRENCIES = ["USD"] as const;
export const PAYPAL_SUPPORTED_MARKETS = ["US"] as const;

function getBaseUrl() {
  const env = process.env.PAYPAL_ENV || "sandbox";
  if (process.env.PAYPAL_API_BASE) return process.env.PAYPAL_API_BASE;
  if (env === "live" || env === "production") return "https://api-m.paypal.com";
  return "https://api-m.sandbox.paypal.com";
}

function isLive(): boolean {
  return getBaseUrl().includes("paypal.com") && !getBaseUrl().includes("sandbox");
}

export function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }
  // Hard guard: this product ships sandbox-only. Live charges require an
  // explicit, deliberate opt-in — never an accidental env var.
  if (isLive() && process.env.PAYPAL_ALLOW_LIVE !== "1") {
    throw new Error(
      "PayPal live environment is disabled. Set PAYPAL_ALLOW_LIVE=1 only after a completed sandbox verification and legal review."
    );
  }
  return {
    clientId,
    clientSecret,
    baseUrl: getBaseUrl(),
    environment: isLive() ? "production" : "sandbox",
  };
}

/**
 * PayPal is a checkout provider only — it never provides product search.
 * Capability `PAYPILOT_PAYPAL` is granted only when credentials are present;
 * it does not mean a live verification has succeeded yet.
 */
export function getPayPalStatus(): ProviderStatus {
  const configured = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const live = isLive();
  const env = live ? "production" : "sandbox";
  if (live && process.env.PAYPAL_ALLOW_LIVE !== "1") {
    return {
      id: "paypal",
      label: "PayPal (live blocked)",
      state: "ERROR",
      capabilities: {
        search: false,
        productDetails: false,
        checkout: ["NOT_CONFIGURED"],
        supportedCurrencies: [...PAYPAL_SUPPORTED_CURRENCIES],
        markets: [...PAYPAL_SUPPORTED_MARKETS],
      },
      message:
        "Live credentials are set but blocked: PAYPAL_ALLOW_LIVE is not '1'. Use the sandbox environment.",
      docsUrl: "https://developer.paypal.com/api/rest/integration/orders-api",
    };
  }
  return {
    id: "paypal",
    label: `PayPal (${env})`,
    state: configured ? "CONFIGURED" : "NOT_CONFIGURED",
    capabilities: {
      search: false,
      productDetails: false,
      checkout: configured ? ["PAYPILOT_PAYPAL"] : ["NOT_CONFIGURED"],
      supportedCurrencies: [...PAYPAL_SUPPORTED_CURRENCIES],
      markets: [...PAYPAL_SUPPORTED_MARKETS],
    },
    message: configured
      ? `Credentials present for ${env}. State becomes VERIFIED after a successful ${env} capture. Mandate charges ${PAYPAL_SUPPORTED_CURRENCIES.join(", ")} only.`
      : "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. PayPal checkout is disabled.",
    docsUrl: "https://developer.paypal.com/api/rest/integration/orders-api",
  };
}
