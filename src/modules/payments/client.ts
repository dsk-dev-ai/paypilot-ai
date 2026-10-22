import { getAccessToken } from "./auth";
import { getPayPalConfig, PAYPAL_SUPPORTED_CURRENCIES } from "./config";

const REQUEST_TIMEOUT_MS = 20_000;

export type CreateOrderInput = {
  amount: string; // decimal string, e.g. "19.99"
  currency_code: string;
  description?: string;
};

export type PayPalLink = { href: string; rel: string; method?: string };
export type PayPalOrder = {
  id: string;
  status: string;
  links?: PayPalLink[];
};

export type CaptureResult = {
  id: string;
  status: string;
  alreadyCaptured: boolean;
  capturedAt: string | null;
};

function assertSupportedCurrency(currency: string): void {
  const code = currency.toUpperCase();
  if (!(PAYPAL_SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
    throw new Error(
      `Mandate's PayPal integration supports ${PAYPAL_SUPPORTED_CURRENCIES.join(", ")} only — got ${code}. Use external checkout for this merchant.`
    );
  }
}

function assertAmount(amount: string): void {
  if (!/^\d+\.\d{2}$/.test(amount)) {
    throw new Error(`Invalid PayPal amount "${amount}" — expected two-decimal string like "19.99"`);
  }
}

async function paypalFetch(
  path: string,
  init: RequestInit = {},
  requestId?: string
): Promise<Response> {
  const token = await getAccessToken();
  const { baseUrl } = getPayPalConfig();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function createPayPalOrder(
  input: CreateOrderInput,
  requestId?: string
): Promise<PayPalOrder> {
  assertSupportedCurrency(input.currency_code);
  assertAmount(input.amount);
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: input.currency_code.toUpperCase(),
          value: input.amount,
        },
        ...(input.description ? { description: input.description.slice(0, 127) } : {}),
      },
    ],
  };
  const res = await paypalFetch(
    "/v2/checkout/orders",
    { method: "POST", body: JSON.stringify(body) },
    requestId
  );
  if (!res.ok) {
    throw new Error(`PayPal create order failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as PayPalOrder;
  if (!data.id || !data.status) {
    throw new Error("PayPal create order returned an unexpected payload");
  }
  return data;
}

export async function getPayPalOrder(id: string): Promise<PayPalOrder> {
  if (!/^[\w-]{8,64}$/.test(id)) {
    throw new Error("Invalid PayPal order id");
  }
  const res = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`PayPal get order failed: HTTP ${res.status}`);
  }
  return (await res.json()) as PayPalOrder;
}

/**
 * Capture after the buyer approved. Idempotent: an already-CAPTURED order is
 * reported as such instead of failing, so return-URL double-loads are safe.
 */
export async function capturePayPalOrder(id: string, requestId?: string): Promise<CaptureResult> {
  const existing = await getPayPalOrder(id);
  if (existing.status === "COMPLETED") {
    return { id, status: "COMPLETED", alreadyCaptured: true, capturedAt: new Date().toISOString() };
  }
  if (existing.status !== "APPROVED") {
    throw new Error(`PayPal order is ${existing.status}; only APPROVED orders can be captured`);
  }
  const res = await paypalFetch(
    `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
    { method: "POST" },
    requestId
  );
  if (!res.ok) {
    throw new Error(`PayPal capture failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { id?: string; status?: string };
  const status = data.status ?? "UNKNOWN";
  if (status !== "COMPLETED") {
    throw new Error(`PayPal capture did not complete (status ${status})`);
  }
  return { id: data.id ?? id, status, alreadyCaptured: false, capturedAt: new Date().toISOString() };
}

export function getApproveUrl(order: PayPalOrder): string | null {
  return order.links?.find((l) => l.rel === "approve")?.href ?? null;
}
