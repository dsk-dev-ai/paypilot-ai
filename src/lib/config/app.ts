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
