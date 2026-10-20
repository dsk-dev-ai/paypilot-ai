import { getAccessToken } from "./auth";
import { getPayPalConfig } from "./config";
import { PayPalOrder } from "./types";

export type CreateOrderInput = {
  amount: string; // e.g., "10.00"
  currency_code?: string;
};

export async function createPayPalOrder(input: CreateOrderInput): Promise<PayPalOrder> {
  const token = await getAccessToken();
  const { baseUrl } = getPayPalConfig();
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: input.currency_code || "USD",
          value: input.amount,
        },
      },
    ],
  };
  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status}`);
  }
  const data = (await res.json()) as PayPalOrder;
  return data;
}

export async function getPayPalOrder(id: string): Promise<PayPalOrder> {
  const token = await getAccessToken();
  const { baseUrl } = getPayPalConfig();
  const res = await fetch(`${baseUrl}/v2/checkout/orders/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`PayPal get order failed: ${res.status}`);
  }
  return (await res.json()) as PayPalOrder;
}

export async function capturePayPalOrder(id: string): Promise<unknown> {
  const token = await getAccessToken();
  const { baseUrl } = getPayPalConfig();
  const res = await fetch(`${baseUrl}/v2/checkout/orders/${id}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    await res.text();
    throw new Error(`PayPal capture failed: ${res.status}`);
  }
  return await res.json();
}
