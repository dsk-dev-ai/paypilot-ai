function getBaseUrl() {
  const env = process.env.PAYPAL_ENV || "sandbox";
  if (process.env.PAYPAL_API_BASE) return process.env.PAYPAL_API_BASE;
  if (env === "live") return "https://api-m.paypal.com";
  return "https://api-m.sandbox.paypal.com";
}

export function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }
  return {
    clientId,
    clientSecret,
    baseUrl: getBaseUrl(),
  };
}
