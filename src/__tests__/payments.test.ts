import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { capturePayPalOrder, createPayPalOrder } from "@/modules/payments/client";
import { __resetPayPalAuthCache } from "@/modules/payments/auth";
import { getPayPalConfig, getPayPalStatus } from "@/modules/payments/config";

const BASE = "https://api-m.sandbox.paypal.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PAYPAL_CLIENT_ID", "test-client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "test-secret");
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("PAYPAL_API_BASE", BASE);
  vi.stubEnv("PAYPAL_ALLOW_LIVE", "");
  __resetPayPalAuthCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function mockAuthAnd<T>(
  call: () => Promise<T>,
  endpoints: Array<{ match: RegExp; body: unknown; status?: number }>
): Promise<{ result: T; fetchMock: ReturnType<typeof vi.fn> }> {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.endsWith("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "tok", token_type: "Bearer", expires_in: 32400 });
    }
    const hit = endpoints.find((e) => e.match.test(u));
    if (!hit) throw new Error(`Unexpected fetch: ${u}`);
    return jsonResponse(hit.body, hit.status ?? 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = await call();
  return { result, fetchMock };
}

describe("createPayPalOrder", () => {
  test("creates a capture intent order with validated amount and currency", async () => {
    const { result, fetchMock } = await mockAuthAnd(
      () => createPayPalOrder({ amount: "19.99", currency_code: "USD", description: "test" }),
      [{ match: /\/v2\/checkout\/orders$/, body: { id: "PP12345678", status: "CREATED", links: [{ rel: "approve", href: "https://paypal.com/approve/PP12345678" }] } }]
    );
    expect(result.id).toBe("PP12345678");
    const orderCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/v2/checkout/orders"));
    const init = orderCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units[0].amount).toEqual({ currency_code: "USD", value: "19.99" });
  });

  test("forwards PayPal-Request-Id for idempotent creation", async () => {
    const { fetchMock } = await mockAuthAnd(
      () => createPayPalOrder({ amount: "19.99", currency_code: "USD" }, "mandate_req_1"),
      [{ match: /\/v2\/checkout\/orders$/, body: { id: "PP12345678", status: "CREATED" } }]
    );
    const orderCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/v2/checkout/orders"));
    const init = orderCall?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["PayPal-Request-Id"]).toBe("mandate_req_1");
  });

  test("rejects unsupported currency before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createPayPalOrder({ amount: "19.99", currency_code: "INR" })).rejects.toThrow(/supports USD only/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects malformed amounts", async () => {
    await expect(createPayPalOrder({ amount: "19.9", currency_code: "USD" })).rejects.toThrow(/Invalid PayPal amount/);
    await expect(createPayPalOrder({ amount: "abc", currency_code: "USD" })).rejects.toThrow(/Invalid PayPal amount/);
    await expect(createPayPalOrder({ amount: "19.999", currency_code: "USD" })).rejects.toThrow(/Invalid PayPal amount/);
  });
});

describe("capturePayPalOrder", () => {
  test("captures an APPROVED order and requires COMPLETED status", async () => {
    const { result } = await mockAuthAnd(() => capturePayPalOrder("PP12345678"), [
      { match: /\/v2\/checkout\/orders\/PP12345678$/, body: { id: "PP12345678", status: "APPROVED" } },
      { match: /\/v2\/checkout\/orders\/PP12345678\/capture$/, body: { id: "PP12345678", status: "COMPLETED" } },
    ]);
    expect(result.status).toBe("COMPLETED");
    expect(result.alreadyCaptured).toBe(false);
  });

  test("is idempotent when already captured", async () => {
    const { result } = await mockAuthAnd(() => capturePayPalOrder("PP12345678"), [
      { match: /\/v2\/checkout\/orders\/PP12345678$/, body: { id: "PP12345678", status: "COMPLETED" } },
    ]);
    expect(result.alreadyCaptured).toBe(true);
  });

  test("refuses to capture non-APPROVED orders", async () => {
    await expect(
      mockAuthAnd(() => capturePayPalOrder("PP12345678"), [
        { match: /\/v2\/checkout\/orders\/PP12345678$/, body: { id: "PP12345678", status: "CREATED" } },
      ])
    ).rejects.toThrow(/CREATED/);
  });

  test("rejects invalid order ids without network access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(capturePayPalOrder("x")).rejects.toThrow(/Invalid PayPal order id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("PayPal config safety", () => {
  test("live environment is blocked without PAYPAL_ALLOW_LIVE=1", () => {
    vi.stubEnv("PAYPAL_ENV", "live");
    vi.stubEnv("PAYPAL_API_BASE", "https://api-m.paypal.com");
    expect(() => getPayPalConfig()).toThrow(/live environment is disabled/);
    vi.stubEnv("PAYPAL_ALLOW_LIVE", "1");
    expect(getPayPalConfig().environment).toBe("production");
  });

  test("status is CONFIGURED but not VERIFIED for sandbox credentials", () => {
    const s = getPayPalStatus();
    expect(s.state).toBe("CONFIGURED");
    expect(s.capabilities.checkout).toEqual(["PAYPILOT_PAYPAL"]);
    expect(s.capabilities.search).toBe(false);
    expect(s.message).toContain("VERIFIED");
  });

  test("status without credentials is NOT_CONFIGURED", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    const s = getPayPalStatus();
    expect(s.state).toBe("NOT_CONFIGURED");
    expect(s.capabilities.checkout).toEqual(["NOT_CONFIGURED"]);
  });
});

// keeps BASE referenced for readability of the mock surface
void BASE;
