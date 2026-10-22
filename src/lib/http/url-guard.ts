import { ProviderError } from "@/lib/core/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Validate a URL for safe outbound requests (SSRF protection).
 * Allows only http(s) and rejects loopback, link-local, private ranges,
 * and common metadata hosts. DNS-rebinding is out of scope for v1 but
 * hostname/IP checks cover the practical cases.
 */
export function assertSafeExternalUrl(url: string, provider = "url-guard"): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProviderError(provider, "INVALID_REQUEST", `Invalid URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ProviderError(provider, "INVALID_REQUEST", `URL protocol not allowed: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new ProviderError(provider, "INVALID_REQUEST", `URL host not allowed`);
  }
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    throw new ProviderError(provider, "INVALID_REQUEST", `URL host not allowed`);
  }
  if (isPrivateIpv4(host)) {
    throw new ProviderError(provider, "INVALID_REQUEST", `URL host resolves to a private address`);
  }
  if (/^[0-9a-f:]+$/.test(host) && host.includes(":")) {
    // IPv6 loopback / link-local / unique-local
    if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) {
      throw new ProviderError(provider, "INVALID_REQUEST", `URL host resolves to a private address`);
    }
  }
  return parsed;
}

/** fetch() wrapper with timeout + SSRF guard for a caller-supplied base URL. */
export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number; provider?: string } = {}
): Promise<Response> {
  const provider = init.provider ?? "fetch";
  const safeUrl = assertSafeExternalUrl(url, provider);
  const timeoutMs = init.timeoutMs ?? 10000;
  const externalSignal = init.signal;
  const rest = { ...init } as RequestInit & { timeoutMs?: number; provider?: string };
  delete rest.timeoutMs;
  delete rest.provider;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);
  try {
    return await fetch(safeUrl.toString(), { ...rest, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      throw new ProviderError(provider, "TIMEOUT", `Request timed out after ${timeoutMs}ms`);
    }
    throw new ProviderError(provider, "NETWORK", "Network request failed", { retryable: true });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
