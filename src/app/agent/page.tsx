"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card, SectionTitle, Spinner } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { formatMinor } from "@/lib/money-format";

type Mandate = {
  id: string;
  name: string;
  budgetMinor: number;
  currency: string;
  maxQuantityPerItem: number;
  maxTotalItems: number;
  active?: boolean;
};

type ProposalItem = {
  productId: string;
  title: string;
  tagline: string;
  category: string;
  emoji: string;
  gradient: string;
  highlights: string[];
  priceMinor: number;
  currency: string;
  quantity: number;
  reason: string;
  deliverable: { type: string; label: string; fileName?: string };
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

type ProposalResponse = {
  source: string;
  aiError: string | null;
  reply: string;
  reasoning: string;
  items: ProposalItem[];
  subtotalMinor: number;
  currency: string;
  evaluation: Evaluation | null;
  planId: string | null;
};

const EXAMPLES = [
  "I'm building an AI agent and need a starter kit plus a security checklist under $50.",
  "Prepare a hackathon demo pack: pitch deck, demo script, and a launch checklist.",
  "I need design assets for a SaaS dashboard and a landing page. Budget is $80.",
];

export default function AgentPage() {
  const [message, setMessage] = useState("");
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [dbReady, setDbReady] = useState(true);
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [committedPlanId, setCommittedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mandate" | "plan" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mandates")
      .then(async (res) => {
        if (res.status === 503) {
          if (!cancelled) setDbReady(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const active = (data.mandates ?? []).filter((m: Mandate) => m.active);
        setMandates(active);
        if (active[0]) setMandateId(active[0].id);
      })
      .catch(() => {
        /* offline empty state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mandate = mandates.find((m) => m.id === mandateId) ?? null;

  const createDemoMandate = async () => {
    setBusy("mandate");
    setError(null);
    try {
      const res = await fetch("/api/demo/bootstrap", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not create the demo budget");
      const m: Mandate = data.mandate;
      setMandates((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
      setMandateId(m.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the demo budget");
    } finally {
      setBusy(null);
    }
  };

  const propose = async () => {
    if (message.trim().length < 3) {
      setError("Describe what you want in a sentence or two.");
      return;
    }
    setBusy("plan");
    setError(null);
    setCommittedPlanId(null);
    try {
      const res = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mandateId: mandateId || undefined, commit: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The agent could not build a plan");
      setProposal(data as ProposalResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The agent could not build a plan");
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!proposal) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          mandateId: mandateId || undefined,
          commit: true,
          items: proposal.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not save the proposal to your plan");
      setProposal(data as ProposalResponse);
      setCommittedPlanId(data.planId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the proposal to your plan");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Purchasing agent"
        subtitle="Describe a goal. The agent picks only from the PayPilot Store catalog, then your signed mandate decides what is actually allowed."
        right={<Badge tone="info">grounded · human-approved</Badge>}
      />

      {!dbReady ? (
        <Card className="border-warn/30 bg-warn/5 p-4 text-sm text-warn">
          Postgres is not connected. Start it with <code className="text-text">docker compose up -d db</code>{" "}
          and set <code className="text-text">DATABASE_URL</code> to commit proposals to a plan.
        </Card>
      ) : null}
      {error ? <Card className="border-danger/30 bg-danger/5 p-3.5 text-sm text-danger">{error}</Card> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3 p-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">What are you trying to do?</span>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={800}
                rows={4}
                placeholder="e.g. I'm shipping an AI agent and need a starter kit, a security checklist, and a demo script under $60."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setMessage(example)}
                  className="rounded-full border border-line px-3 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {example.length > 62 ? `${example.slice(0, 62)}…` : example}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy !== null} onClick={() => void propose()}>
                {busy === "plan" ? <Spinner /> : null} Build a grounded plan
              </Button>
              {proposal ? (
                <Button variant="secondary" disabled={busy !== null} onClick={() => void propose()}>
                  Regenerate
                </Button>
              ) : null}
            </div>
          </Card>

          {proposal ? (
            <div className="space-y-4">
              <Card className="space-y-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Agent proposal</h2>
                  <div className="flex items-center gap-2">
                    <Badge tone={proposal.source === "gemini" ? "info" : "neutral"}>
                      {proposal.source === "gemini"
                        ? "Gemini · grounded"
                        : proposal.source === "confirmed"
                          ? "Confirmed lines"
                          : "Rule-based fallback"}
                    </Badge>
                    <Badge tone="neutral">{proposal.items.length} lines</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted">{proposal.reply}</p>
                {proposal.aiError ? (
                  <p className="text-[11px] text-faint">Model note: {proposal.aiError}</p>
                ) : null}
              </Card>

              <Card className="overflow-hidden">
                <ul className="divide-y divide-line/60">
                  {proposal.items.map((it) => (
                    <li key={it.productId} className="flex items-start gap-3 px-4 py-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${it.gradient} text-2xl`}>
                        {it.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{it.title}</p>
                          <Badge tone="neutral">× {it.quantity}</Badge>
                          <Badge tone="accent">{it.category}</Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-faint">{it.reason}</p>
                        <p className="mt-1 text-[11px] text-faint">{it.deliverable.label}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatMinor(it.priceMinor * it.quantity, it.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <div>
                    <p className="text-xs text-faint">Proposed subtotal</p>
                    <p className="text-lg font-semibold">{formatMinor(proposal.subtotalMinor, proposal.currency)}</p>
                  </div>
                  {committedPlanId ? (
                    <ButtonLink href="/plan">Review &amp; approve in Plan</ButtonLink>
                  ) : (
                    <Button disabled={busy !== null || !dbReady} onClick={() => void commit()}>
                      {busy === "commit" ? <Spinner /> : null} Send to plan for approval
                    </Button>
                  )}
                </div>
              </Card>

              {committedPlanId ? (
                <Card className="border-success/30 bg-success/5 p-3.5 text-sm text-success">
                  Draft plan updated with exactly these {proposal.items.length} line(s). The next step is
                  human approval — that is what issues the SHA-256 consent artifact.
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Spending mandate</h2>
            {mandate ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">{mandate.name}</span>
                  <Badge tone="success">ACTIVE</Badge>
                </div>
                <p className="text-xl font-semibold">{formatMinor(mandate.budgetMinor, mandate.currency)}</p>
                <ul className="space-y-1 text-[11px] text-faint">
                  <li>Max {mandate.maxQuantityPerItem} per item</li>
                  <li>Max {mandate.maxTotalItems} total items</li>
                  <li>Provider allowlist: paypilot (built-in store)</li>
                  <li>Destination: US · digital delivery</li>
                </ul>
              </>
            ) : (
              <>
                <p className="text-xs text-muted">
                  No active mandate. Create a demo budget to let the agent propose and commit a plan.
                </p>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={busy !== null || !dbReady}
                  onClick={() => void createDemoMandate()}
                >
                  {busy === "mandate" ? <Spinner /> : null} Create $100 demo budget
                </Button>
              </>
            )}
          </Card>

          {proposal?.evaluation ? (
            <Card className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Mandate evaluation</h2>
                <Badge
                  tone={
                    proposal.evaluation.decision === "ALLOW"
                      ? "success"
                      : proposal.evaluation.decision === "DENY"
                        ? "danger"
                        : "warn"
                  }
                >
                  {proposal.evaluation.decision}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                Budget {formatMinor(proposal.evaluation.budgetMinor, proposal.evaluation.currency)} · remaining{" "}
                {formatMinor(proposal.evaluation.remainingMinor, proposal.evaluation.currency)}
              </p>
              {proposal.evaluation.violations.map((v) => (
                <p key={v.code} className="text-[11px] text-danger">
                  {v.message}
                </p>
              ))}
              {proposal.evaluation.warnings.map((w) => (
                <p key={w.code} className="text-[11px] text-warn">
                  {w.message}
                </p>
              ))}
            </Card>
          ) : null}

          <Card className="space-y-2 p-4 text-[11px] text-faint">
            <p className="font-semibold text-muted">Why this is safe</p>
            <p>
              The model never sees your payment method and cannot create an order. It can only propose
              catalog ids. A deterministic engine re-checks budget, quantity, provider, and freshness;
              a human then signs the exact cart.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
