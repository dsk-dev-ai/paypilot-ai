import type { Currency } from "@/lib/core/money";

const EXPONENTS: Record<string, number> = { INR: 2, USD: 2, EUR: 2, GBP: 2 };

/** Format minor units for display (client-safe, no server imports). */
export function formatMinor(
  amountMinor: number,
  currency: Currency | string,
  locale?: string
): string {
  const exp = EXPONENTS[currency] ?? 2;
  const value = amountMinor / 10 ** exp;
  const regionLocale =
    locale ?? (currency === "INR" ? "en-IN" : currency === "USD" ? "en-US" : "en-GB");
  try {
    return new Intl.NumberFormat(regionLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(exp)}`;
  }
}

export function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
