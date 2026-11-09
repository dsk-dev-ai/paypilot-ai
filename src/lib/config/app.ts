import { headers } from "next/headers";

/**
 * Public base URL of the running app. Used to build absolute return URLs for
 * PayPal and canonical links for the built-in store. Never contains secrets.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * Request-derived base URL. On Render (and most proxies) `x-forwarded-host`
 * and `x-forwarded-proto` describe the public origin, so PayPal return URLs are
 * correct even if APP_BASE_URL was not configured. Falls back to the env value
 * when called outside a request context (e.g. unit tests).
 */
export async function getRequestBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    // No request context — use configuration.
  }
  return getAppBaseUrl();
}
