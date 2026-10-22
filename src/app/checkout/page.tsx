"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { formatMinor } from "@/lib/money-format";

type Plan = { id: string; status: string; currency: string; subtotalMinor: number } | null;

type Consent = {
  id: string;
  planId: string;
  contentHash: string;
  approvedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  itemCount: number;
  subtotalMinor: number;
  decision: string;
};

type Intent = {
  provider: string;
  currency: string;
  subtotalMinor: number;
  method: "PAYPILOT_PAYPAL" | "EXTERNAL_CHECKOUT";
  officialUrl: string;
  reason: string;
  orderId: string | null;
  orderState: string | null;
  handoffId: string | null;
  handoffState: string | null;
  approveUrl: string | null;
};

type CheckoutState = { planId: string; intents: Intent[] } | null;

export default function CheckoutPage() {
  const [plan, setPlan] = useState<Plan>(null);
  const [checkout, setCheckout] = useState<CheckoutState>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/checkout");
      const data = await res.json();
      if (res.ok) {
        setPlan(data.plan ?? null);
        setCheckout(data.checkout ?? null);
        setConsent(data.consent ?? null);
      }
    } catch {
      /* empty state shown below */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPlan(data.plan ?? null);
        setCheckout(data.checkout ?? null);
        setConsent(data.consent ?? null);
      })
      .catch(() => {
        /* empty state shown below */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId: consent?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data?.error?.code;
        if (
          [
            "PRICE_CHANGED",
            "CONSENT_REQUIRED",
            "CONSENT_EXPIRED",
            "CONSENT_MISMATCH",
            "CONSENT_TAMPERED",
            "CONSENT_CONSUMED",
            "CONSENT_REVOKED",
          ].includes(code)
        ) {
          setError(data.error?.message ?? "The approved cart is no longer valid.");
          setNotice("reapprove");
          return;
        }
        throw new Error(data?.error?.message ?? "Checkout failed");
      }
      setPlan(data.plan);
      setCheckout(data.checkout);
      setConsent(data.consent ?? consent);
      setNotice("routed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmHandoff = async (handoffId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/checkout/handoffs/${handoffId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Could not record confirmation");
      }
      setNotice("handoff-confirmed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record confirmation");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading checkout…
      </div>
    );
  }

  if (!plan || plan.status === "DRAFT") {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionTitle title="Checkout" subtitle="Per-merchant checkout routing for your approved plan." />
        <EmptyState
          title="Nothing to check out yet"
          body="Approve a shopping plan first. Mandate never charges you directly — each merchant is paid on that merchant's own checkout."
          action={<ButtonLink href="/plan">Go to plan</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Checkout"
        subtitle="One handoff per merchant. Mandate does not merge merchants and never sees your card details."
        right={<Badge tone={plan.status === "CHECKED_OUT" ? "success" : "accent"}>{plan.status}</Badge>}
      />

      {error ? <ErrorState body={error} onRetry={() => setError(null)} /> : null}
      {notice === "reapprove" ? (
        <Card className="border-warn/30 bg-warn/5 p-3.5 text-sm text-warn">
          The approved cart no longer matches this plan. Return to the Plan page and approve again to
          issue a fresh consent hash — checkout cannot bypass consent.
          <div className="mt-2">
            <ButtonLink href="/plan" size="sm" variant="secondary">
              Re-approve plan
            </ButtonLink>
          </div>
        </Card>
      ) : null}
      {notice === "routed" ? (
        <Card className="border-success/30 bg-success/5 p-3.5 text-sm text-success">
          Checkout routing created. Complete each merchant group below.
        </Card>
      ) : null}
      {notice === "handoff-confirmed" ? (
        <Card className="border-success/30 bg-success/5 p-3.5 text-sm text-success">
          Marked as completed on the merchant&apos;s site (self-reported — Mandate cannot verify retailer purchases).
        </Card>
      ) : null}

      {consent ? (
        <Card className="space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Consent artifact</h2>
            <div className="flex items-center gap-2">
              <Badge tone={consent.revokedAt ? "danger" : consent.consumedAt ? "neutral" : "success"}>
                {consent.revokedAt ? "REVOKED" : consent.consumedAt ? "USED" : "SIGNED"}
              </Badge>
              <Badge tone="info">{consent.itemCount} items</Badge>
            </div>
          </div>
          <p className="text-xs text-muted">
            This is the exact cart a human approved. The server recomputes the SHA-256 hash before it
            creates any PayPal order.
          </p>
          <code className="block break-all rounded-lg border border-line bg-panel p-2 text-[10px] leading-relaxed">
            {consent.contentHash}
          </code>
          <p className="text-[11px] text-faint">
            Approved {new Date(consent.approvedAt).toLocaleString()} · expires{" "}
            {new Date(consent.expiresAt).toLocaleString()}
          </p>
        </Card>
      ) : plan.status !== "DRAFT" ? (
        <Card className="border-warn/30 bg-warn/5 p-3.5 text-sm text-warn">
          No consent artifact is attached to this plan. Re-approve it on the Plan page before checkout.
        </Card>
      ) : null}

      {checkout && checkout.intents.length > 0 ? (
        <div className="space-y-4">
          {checkout.intents.map((it) => (
            <Card key={it.provider} className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={it.method === "PAYPILOT_PAYPAL" ? "info" : "accent"}>{it.provider}</Badge>
                  <Badge tone="neutral">{it.method === "PAYPILOT_PAYPAL" ? "PayPal (sandbox)" : "External checkout"}</Badge>
                  {it.orderState ? <Badge tone="neutral">{it.orderState}</Badge> : null}
                  {it.handoffState === "CONFIRMED" ? <Badge tone="success">Marked complete</Badge> : null}
                </div>
                <span className="text-sm font-semibold">{formatMinor(it.subtotalMinor, it.currency)}</span>
              </div>
              <p className="text-xs text-muted">{it.reason}</p>
              <div className="flex flex-wrap items-center gap-2">
                {it.method === "PAYPILOT_PAYPAL" && it.approveUrl ? (
                  <a href={it.approveUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm">Approve payment on PayPal ↗</Button>
                  </a>
                ) : (
                  <a href={it.officialUrl} target="_blank" rel="noopener noreferrer nofollow">
                    <Button size="sm">Open {it.provider} checkout ↗</Button>
                  </a>
                )}
                {it.method === "EXTERNAL_CHECKOUT" && it.handoffId && it.handoffState !== "CONFIRMED" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void confirmHandoff(it.handoffId!)}>
                    I completed this purchase
                  </Button>
                ) : null}
                {it.method === "PAYPILOT_PAYPAL" && it.orderId ? (
                  <ButtonLink href={`/checkout/return?orderId=${it.orderId}`} size="sm" variant="secondary">
                    I approved on PayPal — verify
                  </ButtonLink>
                ) : null}
              </div>
              {it.handoffState === "CONFIRMED" ? (
                <p className="text-[11px] text-faint">
                  Recorded as self-reported. Mandate cannot verify retailer-side purchases.
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || !consent || !!consent.revokedAt || !!consent.consumedAt}
            onClick={() => void startCheckout()}
          >
            {busy ? <Spinner /> : null} Start checkout routing
          </Button>
          <p className="text-xs text-faint">
            Plan {plan.id} · subtotal {formatMinor(plan.subtotalMinor, plan.currency)} (estimates — shipping
            and taxes are added by each merchant)
          </p>
        </div>
      )}
    </div>
  );
}
