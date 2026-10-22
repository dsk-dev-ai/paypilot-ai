import { getPayPalConfig } from "./config";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

const TOKEN_TIMEOUT_MS = 15_000;

/** In-memory token cache — tokens live ~10 minutes; we refresh at 8. */
let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!res.ok) {
    // Never log the credentials or the token itself.
    throw new Error(`PayPal auth failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as TokenResponse;
  cached = { token: data.access_token, expiresAt: Date.now() + Math.min(data.expires_in - 120, 480) * 1000 };
  return cached.token;
}

/** Test hook — clears the token cache between test cases. */
export function __resetPayPalAuthCache(): void {
  cached = null;
}
