"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card, SectionTitle, Spinner } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { formatMinor } from "@/lib/money-format";

type Check = { id: string; label: string; ok: boolean; detail: string };

type VerifyResult = {
  ok: boolean;
  order: {
    id: string;
    state: string;
    currency: string;
    totalMinor: number;
    consentId: string | null;
    consentHash: string | null;
    createdAt: string;
    items: Array<{ title: string; provider: string; quantity: number; unitPriceMinor: number }>;
  };
  fulfillment: {
    status: string;
    deliveredAt: string;
    items: Array<{
      title: string;
      quantity: number;
      deliverableType: string;
      licenseKey: string | null;
      fileName: string | null;
    }>;
  } | null;
  consent: {
    contentHash: string;
    computedHash: string | null;
    decision: string;
    approvedAt: string;
    expiresAt: string;
    consumedAt: string | null;
    revokedAt: string | null;
  } | null;
  ledger: {
    ok: boolean;
    count: number;
    brokenAtSeq: number | null;
    reason: string | null;
    entries: Array<{ seq: number; type: string; hash: string; prevHash: string; createdAt: string }>;
  };
  checks: Check[];
};

function VerifyContent() {
  const params = useSearchParams();
  const initial = params.get("orderId") ?? "";
  const [orderId, setOrderId] = useState(initial);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (id: string) => {
    const trimmed = id.trim();
    try {
      if (!trimmed) throw new Error("Paste an order id to verify.");
      const res = await fetch(`/api/verify?orderId=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Verification failed");
      setResult(data as VerifyResult);
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    fetch(`/api/verify?orderId=${encodeURIComponent(initial)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Verification failed");
        return data as VerifyResult;
      })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Verification failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Order id</span>
          <Input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setLoading(true);
                setError(null);
                void verify(orderId);
              }
            }}
            placeholder="e.g. cm8x9k2f10000abcd1234efgh"
          />
        </label>
        <Button
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError(null);
            void verify(orderId);
          }}
        >
          {loading ? <Spinner /> : null} Recompute evidence
        </Button>
      </Card>

      {error ? <Card className="border-danger/30 bg-danger/5 p-3.5 text-sm text-danger">{error}</Card> : null}

      {result ? (
        <div className="space-y-4">
          <Card
            className={`flex flex-wrap items-center justify-between gap-3 p-5 ${
              result.ok ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={result.ok ? "success" : "danger"}>{result.ok ? "VERIFIED" : "FAILED"}</Badge>
                <span className="text-sm font-semibold">Order {result.order.id.slice(-8)}</span>
                <Badge tone="neutral">{result.order.state}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                {result.order.items.length} line(s) · {formatMinor(result.order.totalMinor, result.order.currency)} ·{" "}
                {new Date(result.order.createdAt).toLocaleString()}
              </p>
            </div>
            <ButtonLink href={`/orders/${result.order.id}`} size="sm" variant="secondary">
              Open order
            </ButtonLink>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Evidence checks</h2>
              <ul className="space-y-2.5">
                {result.checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5">
                    <span className={check.ok ? "text-success" : "text-danger"}>{check.ok ? "✓" : "✕"}</span>
                    <div>
                      <p className="text-xs font-medium text-text">{check.label}</p>
                      <p className="text-[11px] text-faint">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Consent artifact</h2>
                  {result.consent ? (
                    <Badge tone={result.consent.revokedAt ? "danger" : result.consent.consumedAt ? "neutral" : "success"}>
                      {result.consent.revokedAt ? "REVOKED" : result.consent.consumedAt ? "CONSUMED" : "SIGNED"}
                    </Badge>
                  ) : (
                    <Badge tone="danger">MISSING</Badge>
                  )}
                </div>
                {result.consent ? (
                  <>
                    <p className="text-[11px] text-faint">Stored hash</p>
                    <code className="block break-all rounded-lg border border-line bg-panel p-2 text-[10px]">
                      {result.consent.contentHash}
                    </code>
                    <p className="text-[11px] text-faint">Recomputed hash</p>
                    <code className="block break-all rounded-lg border border-line bg-panel p-2 text-[10px]">
                      {result.consent.computedHash ?? "—"}
                    </code>
                    <p className="text-[11px] text-faint">
                      Decision {result.consent.decision} · approved {new Date(result.consent.approvedAt).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted">This order has no bound consent artifact.</p>
                )}
              </Card>

              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Digital delivery</h2>
                  {result.fulfillment ? (
                    <Badge tone="success">{result.fulfillment.status}</Badge>
                  ) : (
                    <Badge tone="neutral">NONE</Badge>
                  )}
                </div>
                {result.fulfillment ? (
                  <ul className="space-y-2">
                    {result.fulfillment.items.map((item, i) => (
                      <li key={i} className="rounded-lg border border-line bg-panel p-2.5">
                        <p className="text-xs font-medium">
                          {item.title} × {item.quantity}
                        </p>
                        <p className="text-[10px] text-faint">{item.deliverableType}</p>
                        {item.licenseKey ? (
                          <code className="mt-1 block text-[10px] text-accent">{item.licenseKey}</code>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">No digital delivery record for this order.</p>
                )}
              </Card>
            </div>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Order ledger receipts</h2>
              <span className="text-[11px] text-faint">
                chain {result.ledger.ok ? "intact" : "broken"} · {result.ledger.count} total entries
              </span>
            </div>
            {result.ledger.entries.length === 0 ? (
              <p className="text-xs text-faint">No ledger entries reference this order.</p>
            ) : (
              <ul className="space-y-1.5">
                {result.ledger.entries.map((entry) => (
                  <li key={entry.seq} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-faint">#{entry.seq}</span>
                    <Badge tone="accent">{entry.type}</Badge>
                    <code className="text-[10px] text-faint">{entry.hash.slice(0, 24)}…</code>
                    <span className="text-[10px] text-faint">{new Date(entry.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Receipt verifier"
        subtitle="Do not trust a green badge. This page re-hashes the approved cart and walks the append-only ledger chain."
        right={<Badge tone="info">independent recomputation</Badge>}
      />
      <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
