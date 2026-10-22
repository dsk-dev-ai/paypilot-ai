"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { formatMinor, formatAge } from "@/lib/money-format";

type PlanItem = {
  id: string;
  listingId: string;
  provider: string;
  title: string;
  canonicalUrl: string;
  imageUrl?: string;
  priceMinor: number;
  currency: string;
  availability: string;
  seller?: string;
  quantity: number;
  approvedPriceMinor: number | null;
  approvedAt: string | null;
  fetchedAt: string;
};

type Plan = {
  id: string;
  status: string;
  currency: string;
  items: PlanItem[];
  subtotalMinor: number;
};

type Mandate = { id: string; name: string; currency: string; active: boolean };

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

type Evaluation = {
  decision: string;
  violations: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  subtotalMinor: number;
  budgetMinor: number;
  remainingMinor: number;
  currency: string;
};

export default function PlanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/plan").then((r) => r.json()), fetch("/api/mandates").then((r) => r.json())])
      .then(([planData, mandateData]) => {
        if (cancelled) return;
        setPlan(planData.plan ?? null);
        setConsent(planData.consent ?? null);
        const ms: Mandate[] = mandateData.mandates ?? [];
        setMandates(ms.filter((m) => m.active));
        const first = ms.find((m) => m.active);
        if (first) setMandateId(first.id);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load plan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQty = async (itemId: string, quantity: number) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/plan/items/${itemId}`, {
        method: quantity === 0 ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(quantity === 0 ? {} : { body: JSON.stringify({ quantity }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Update failed");
      setPlan(data.plan);
      setEvaluation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (confirmWarnings = false) => {
    setBusy(true);
    setError(null);
    setApprovalMessage(null);
    setEvaluation(null);
    try {
      const res = await fetch("/api/plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId: mandateId || undefined, confirmWarnings }),
      });
      const data = await res.json();
      if (res.status === 409 && data.evaluation) {
        setEvaluation(data.evaluation);
        if (data.error?.code === "REQUIRES_APPROVAL" && !confirmWarnings) {
          setApprovalMessage(data.error.message);
        } else {
          setError(data.error?.message ?? "Approval blocked");
        }
        return;
      }
      if (!res.ok) throw new Error(data?.error?.message ?? "Approval failed");
      setPlan(data.plan);
      setEvaluation(data.evaluation);
      setConsent(data.consent ?? null);
      setApprovalMessage("Plan approved — a signed consent artifact now binds this exact cart.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/plan/cancel", { method: "POST" });
      if (res.ok) {
        setPlan(null);
        setEvaluation(null);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading plan…
      </div>
    );
  }

  if (error && !plan) return <ErrorState body={error} />;

  if (!plan || plan.items.length === 0) {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionTitle title="Shopping plan" subtitle="Your unified Mandate plan across merchants." />
        <EmptyState
          title="Your plan is empty"
          body="Search for products and add real listings to your plan. Mandate's plan is not a retailer cart — each merchant checkout happens on the merchant's own site."
          action={<ButtonLink href="/search">Search products</ButtonLink>}
        />
      </div>
    );
  }

  const byMerchant = new Map<string, PlanItem[]>();
  for (const item of plan.items) {
    const list = byMerchant.get(item.provider) ?? [];
    list.push(item);
    byMerchant.set(item.provider, list);
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Shopping plan"
        subtitle="Grouped per merchant. Each merchant is checked out separately on their official site — never merged into one payment."
        right={<Badge tone={plan.status === "APPROVED" ? "success" : "accent"}>{plan.status}</Badge>}
      />

      {error ? <ErrorState body={error} onRetry={() => setError(null)} /> : null}
      {approvalMessage ? (
        <Card className="border-success/30 bg-success/5 p-3.5 text-sm text-success">{approvalMessage}</Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {Array.from(byMerchant.entries()).map(([provider, items]) => {
            const merchantSubtotal = items.reduce((a, it) => a + it.priceMinor * it.quantity, 0);
            return (
              <Card key={provider} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{provider}</Badge>
                    <span className="text-xs text-faint">{items.length} item(s)</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatMinor(merchantSubtotal, items[0].currency)}
                  </span>
                </div>
                <ul className="divide-y divide-line/60">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-panel">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt="" className="h-full w-full object-contain" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.title}</p>
                        <p className="text-xs text-faint">
                          {formatMinor(it.priceMinor, it.currency)} each · data {formatAge(it.fetchedAt)}
                          {it.approvedPriceMinor != null && it.approvedPriceMinor !== it.priceMinor ? (
                            <span className="text-warn"> · price changed since approval</span>
                          ) : it.approvedPriceMinor != null ? (
                            <span className="text-success"> · snapshot locked</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={busy}
                          onClick={() => void updateQty(it.id, it.quantity - 1)}
                          className="h-7 w-7 rounded-lg border border-line text-muted hover:text-text disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{it.quantity}</span>
                        <button
                          disabled={busy}
                          onClick={() => void updateQty(it.id, it.quantity + 1)}
                          className="h-7 w-7 rounded-lg border border-line text-muted hover:text-text disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void updateQty(it.id, 0)}
                          className="ml-1 h-7 rounded-lg border border-danger/30 px-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line px-4 py-2.5 text-[11px] text-faint">
                  Checkout for {provider} items happens on {provider}&apos;s official website.
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold">Summary</h2>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">Subtotal ({plan.items.length} lines)</span>
              <span className="text-xl font-semibold">{formatMinor(plan.subtotalMinor, plan.currency)}</span>
            </div>
            <p className="text-[11px] text-faint">
              Estimated — shipping and taxes are not included and may be added by each merchant at their checkout.
            </p>
            {mandates.length > 0 ? (
              <Select value={mandateId} onChange={(e) => setMandateId(e.target.value)} aria-label="Mandate">
                <option value="">No mandate (not recommended)</option>
                {mandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-xs text-warn">
                No active mandate. Create one in Mandate to enforce budget rules.
              </p>
            )}
            <Button
              className="w-full"
              disabled={busy || plan.status === "CHECKOUT_IN_PROGRESS"}
              onClick={() => void approve(false)}
            >
              {busy ? <Spinner /> : null}{" "}
              {plan.status === "APPROVED" ? "Re-approve plan" : "Approve plan"}
            </Button>
            {approvalMessage && evaluation?.decision === "REQUIRES_APPROVAL" ? (
              <Button className="w-full" variant="danger" disabled={busy} onClick={() => void approve(true)}>
                Confirm at current prices
              </Button>
            ) : null}
            <Button className="w-full" variant="ghost" disabled={busy} onClick={() => void cancelPlan()}>
              Cancel plan
            </Button>
          </Card>

          {evaluation ? (
            <Card className="p-5 space-y-2">
              <h2 className="text-sm font-semibold">Mandate evaluation</h2>
              <Badge tone={evaluation.decision === "ALLOW" ? "success" : evaluation.decision === "DENY" ? "danger" : "warn"}>
                {evaluation.decision}
              </Badge>
              <p className="text-xs text-muted">
                Budget {formatMinor(evaluation.budgetMinor, evaluation.currency)} · remaining{" "}
                {formatMinor(evaluation.remainingMinor, evaluation.currency)}
              </p>
              {evaluation.violations.length > 0 ? (
                <ul className="space-y-1 text-xs text-danger">
                  {evaluation.violations.map((v, i) => (
                    <li key={i}>{v.message}</li>
                  ))}
                </ul>
              ) : null}
              {evaluation.warnings.length > 0 ? (
                <ul className="space-y-1 text-xs text-warn">
                  {evaluation.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          {consent ? (
            <Card className="space-y-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Consent artifact</h2>
                <Badge tone={consent.revokedAt ? "danger" : consent.consumedAt ? "neutral" : "success"}>
                  {consent.revokedAt ? "REVOKED" : consent.consumedAt ? "USED" : "SIGNED"}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {consent.itemCount} item(s) · {formatMinor(consent.subtotalMinor, plan.currency)} ·{" "}
                {consent.decision === "NO_MANDATE" ? "no policy mandate" : `policy ${consent.decision}`}
              </p>
              <p className="text-[11px] text-faint">SHA-256 cart hash</p>
              <code className="block break-all rounded-lg border border-line bg-panel p-2 text-[10px] leading-relaxed">
                {consent.contentHash}
              </code>
              <p className="text-[11px] text-faint">
                Expires {new Date(consent.expiresAt).toLocaleString()}. Checkout recomputes this hash and
                refuses any cart that changed.
              </p>
              <ButtonLink href="/checkout" size="sm" className="w-full">
                Go to verified checkout
              </ButtonLink>
            </Card>
          ) : null}

          <Card className="p-4 text-[11px] text-faint">
            The Mandate plan is <strong className="text-muted">not</strong> a cart on any retailer&apos;s
            website. Approving a plan locks price snapshots and issues a content-addressed consent
            artifact — it does not reserve stock at any merchant.
          </Card>
        </div>
      </div>
    </div>
  );
}
