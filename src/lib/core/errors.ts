export const PROVIDER_ERROR_CODES = [
  "NOT_CONFIGURED",
  "ACCESS_DENIED",
  "TIMEOUT",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "INVALID_RESPONSE",
  "NETWORK",
  "INVALID_REQUEST",
] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly detail?: string;

  constructor(
    provider: string,
    code: ProviderErrorCode,
    message: string,
    opts: { retryable?: boolean; status?: number; detail?: string } = {}
  ) {
    super(`[${provider}] ${code}: ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.retryable = opts.retryable ?? DEFAULT_RETRYABLE.has(code);
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

const DEFAULT_RETRYABLE = new Set<ProviderErrorCode>(["TIMEOUT", "RATE_LIMITED", "NETWORK"]);

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}

/** Convert unknown thrown errors into a safe ProviderError (never leaks secrets). */
export function toProviderError(provider: string, e: unknown): ProviderError {
  if (isProviderError(e)) return e;
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return new ProviderError(provider, "TIMEOUT", "Request timed out");
    }
    return new ProviderError(provider, "UPSTREAM_ERROR", e.message.slice(0, 300));
  }
  return new ProviderError(provider, "UPSTREAM_ERROR", "Unknown provider failure");
}
