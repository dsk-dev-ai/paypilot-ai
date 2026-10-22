export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const EXPONENTS: Record<Currency, number> = { INR: 2, USD: 2, EUR: 2, GBP: 2 };

export type Money = { amountMinor: number; currency: Currency };

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function currencyExponent(currency: Currency): number {
  return EXPONENTS[currency];
}

export function money(currency: Currency, amountMinor: number): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`Money amountMinor must be a safe integer, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function zeroMoney(currency: Currency): Money {
  return { amountMinor: 0, currency };
}

/** Parse a decimal string or number ("10.99", 10.99) into minor units. */
export function parseMoney(value: string | number, currency: Currency): Money {
  const exp = currencyExponent(currency);
  const scale = 10 ** exp;
  const str = typeof value === "number" ? value.toFixed(exp) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid monetary amount: ${value}`);
  }
  const negative = str.startsWith("-");
  const [whole, frac = ""] = (negative ? str.slice(1) : str).split(".");
  if (frac.length > exp) {
    // Allow trailing-zero precision beyond the currency exponent (e.g. "10.500000")
    if (/0+$/.test(frac.slice(exp))) {
      return parseMoney(`${negative ? "-" : ""}${whole}.${frac.slice(0, exp)}`, currency);
    }
    throw new Error(`Too many decimal places for ${currency}: ${value}`);
  }
  const fracPadded = frac.padEnd(exp, "0");
  const minor = Number(whole) * scale + Number(fracPadded);
  const total = Number.isSafeInteger(minor) ? minor : NaN;
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Monetary amount out of range: ${value}`);
  }
  return money(currency, negative ? -total : total);
}

/** Format minor units as a decimal string, e.g. "1099" -> "10.99". */
export function toDecimalString(m: Money): string {
  const exp = currencyExponent(m.currency);
  const scale = 10 ** exp;
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor);
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(exp, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function formatMoney(m: Money, locale = "en-IN"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency }).format(
      Number(toDecimalString(m))
    );
  } catch {
    return `${m.currency} ${toDecimalString(m)}`;
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.currency, a.amountMinor + b.amountMinor);
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.currency, a.amountMinor - b.amountMinor);
}

export function mulInt(m: Money, factor: number): Money {
  if (!Number.isSafeInteger(factor) || factor < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${factor}`);
  }
  return money(m.currency, m.amountMinor * factor);
}

export function negate(m: Money): Money {
  return money(m.currency, -m.amountMinor);
}

export function cmpMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function isZeroMoney(m: Money): boolean {
  return m.amountMinor === 0;
}

export function minMoney(a: Money, b: Money): Money {
  return cmpMoney(a, b) <= 0 ? a : b;
}

export function maxMoney(a: Money, b: Money): Money {
  return cmpMoney(a, b) >= 0 ? a : b;
}

export function sumMoney(items: readonly Money[]): Money {
  if (items.length === 0) throw new Error("Cannot sum an empty list of Money");
  return items.reduce((acc, m) => addMoney(acc, m));
}
