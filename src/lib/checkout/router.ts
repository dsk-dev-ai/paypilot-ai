import type { ProviderCapabilities } from "@/lib/core/provider";
import { isCurrency, money, toDecimalString } from "@/lib/core/money";

export type CheckoutPlanItem = {
  provider: string;
  currency: string;
  priceMinor: number;
  quantity: number;
  canonicalUrl: string;
};

export type CheckoutMethod = "PAYPILOT_PAYPAL" | "EXTERNAL_CHECKOUT";

export type CheckoutIntent = {
  provider: string;
  currency: string;
  subtotalMinor: number;
  items: CheckoutPlanItem[];
  method: CheckoutMethod;
  /** Official merchant location where this group's checkout is completed. */
  officialUrl: string;
  /** Human-readable justification — always honest about what Mandate can and cannot do. */
  reason: string;
};

export type PayPalCapability = {
  configured: boolean;
  supportedCurrencies: string[];
  environment: string;
};

/**
 * Pure, deterministic checkout routing. Each merchant group gets exactly one
 * checkout method. Mandate NEVER merges merchants into a single payment:
 * - PAYPILOT_PAYPAL  — only when the provider explicitly declares the
 *   capability AND the plan currency is supported by Mandate's PayPal setup.
 * - EXTERNAL_CHECKOUT — always available; the buyer completes payment on the
 *   merchant's own website. Mandate records the handoff, never the card data.
 */
export function routeCheckout(
  items: CheckoutPlanItem[],
  capabilities: Record<string, ProviderCapabilities | undefined>,
  paypal: PayPalCapability
): CheckoutIntent[] {
  const byMerchant = new Map<string, CheckoutPlanItem[]>();
  for (const it of items) {
    const list = byMerchant.get(it.provider) ?? [];
    list.push(it);
    byMerchant.set(it.provider, list);
  }
  const intents: CheckoutIntent[] = [];
  for (const [provider, group] of byMerchant) {
    const currency = group[0].currency;
    const subtotalMinor = group.reduce((a, it) => a + it.priceMinor * it.quantity, 0);
    const caps = capabilities[provider]?.checkout ?? [];
    const currencySupported = paypal.supportedCurrencies.includes(currency);
    if (paypal.configured && caps.includes("PAYPILOT_PAYPAL") && currencySupported) {
      intents.push({
        provider,
        currency,
        subtotalMinor,
        items: group,
        method: "PAYPILOT_PAYPAL",
        officialUrl: group[0].canonicalUrl,
        reason: `${provider} supports Mandate PayPal checkout in ${currency} (${paypal.environment}).`,
      });
    } else {
      let reason: string;
      if (!paypal.configured) {
        reason = `${provider}: PayPal is not configured, so this group completes on ${provider}'s official website. Mandate never takes card details itself.`;
      } else if (!caps.includes("PAYPILOT_PAYPAL")) {
        reason = `${provider} only supports external checkout — you complete payment on ${provider}'s official website. Mandate never takes card details itself.`;
      } else {
        reason = `PayPal does not support ${currency} in this setup; this group completes on ${provider}'s official website.`;
      }
      intents.push({
        provider,
        currency,
        subtotalMinor,
        items: group,
        method: "EXTERNAL_CHECKOUT",
        officialUrl: new URL(group[0].canonicalUrl).toString(),
        reason,
      });
    }
  }
  return intents.sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Decimal string for PayPal amounts, e.g. 199900 INR → "1999.00". */
export function paypalAmount(minor: number, currency: string): string {
  if (!isCurrency(currency)) throw new Error(`Unsupported currency: ${currency}`);
  return toDecimalString(money(currency, minor));
}
