import { getPayPalConfig } from "./config";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}
