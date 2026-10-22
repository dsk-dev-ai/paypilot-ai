"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, Card, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

type Mandate = {
  id: string;
  name: string;
  active: boolean;
  budgetMinor: number;
  currency: string;
  minUnspentMinor: number;
  preferredBrands: string[];
  excludedBrands: string[];
  maxQuantityPerItem: number;
  maxTotalItems: number;
  allowedProviders: string[];
  excludedProviders: string[];
  allowedDestinations: string[];
  maxListingAgeMinutes: number;
};

type Evaluation = {
  decision: "ALLOW" | "DENY" | "REQUIRES_APPROVAL";
  violations: Array<{ code: string; message: string; listingId?: string }>;
  warnings: Array<{ code: string; message: string; listingId?: string }>;
  subtotalMinor: number;
  budgetMinor: number;
  remainingMinor: number;
  currency: string;
  itemCount: number;
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MandatePage() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "My mandate",
    budget: "5000",
    currency: "INR",
    minUnspent: "0",
    preferredBrands: "",
    excludedBrands: "",
    maxQty: "2",
    maxItems: "20",
    allowedProviders: "",
    excludedProviders: "",
    destinations: "IN,US,UK,EU",
    maxAgeHours: "24",
  });

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mandates");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to load mandates");
      setMandates(data.mandates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mandates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mandates")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMandates(data.mandates ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load mandates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          budgetMinor: Math.round(Number(form.budget) * 100),
          currency: form.currency,
          minUnspentMinor: Math.round(Number(form.minUnspent) * 100),
          preferredBrands: splitCsv(form.preferredBrands),
          excludedBrands: splitCsv(form.excludedBrands),
          maxQuantityPerItem: Number(form.maxQty),
          maxTotalItems: Number(form.maxItems),
          allowedProviders: splitCsv(form.allowedProviders),
          excludedProviders: splitCsv(form.excludedProviders),
          allowedDestinations: splitCsv(form.destinations),
          maxListingAgeMinutes: Math.max(5, Number(form.maxAgeHours) * 60),
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed to save mandate");
      setSelectedId(data.mandate.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save mandate");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/mandates/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedId === id) setSelectedId(null);
      setEvaluation(null);
      await load();
    }
  };

  const evaluate = async () => {
    if (!selectedId) return;
    setEvaluating(true);
    setError(null);
    setEvaluation(null);
    try {
      const res = await fetch("/api/mandates/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandateId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Evaluation failed");
      setEvaluation(data.evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  const money = (minor: number, currency: string) =>
    `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Purchase Mandate"
        subtitle="Your deterministic purchase rules. Every plan and checkout is validated against the active mandate — no AI involved in the decision."
      />

      {error ? <ErrorState body={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">New mandate</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Currency">
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </Field>
            <Field label="Max budget" hint="Total you are willing to spend">
              <Input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} inputMode="decimal" />
            </Field>
            <Field label="Min unspent" hint="Budget that must remain unspent">
              <Input value={form.minUnspent} onChange={(e) => setForm({ ...form, minUnspent: e.target.value })} inputMode="decimal" />
            </Field>
            <Field label="Preferred brands" hint="Comma-separated">
              <Input value={form.preferredBrands} onChange={(e) => setForm({ ...form, preferredBrands: e.target.value })} placeholder="Sony, Apple" />
            </Field>
            <Field label="Excluded brands" hint="Comma-separated">
              <Input value={form.excludedBrands} onChange={(e) => setForm({ ...form, excludedBrands: e.target.value })} />
            </Field>
            <Field label="Max qty per item">
              <Input value={form.maxQty} onChange={(e) => setForm({ ...form, maxQty: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Max total items">
              <Input value={form.maxItems} onChange={(e) => setForm({ ...form, maxItems: e.target.value })} inputMode="numeric" />
            </Field>
            <Field label="Allowed providers" hint="Blank = any configured provider">
              <Input value={form.allowedProviders} onChange={(e) => setForm({ ...form, allowedProviders: e.target.value })} placeholder="ebay, flipkart" />
            </Field>
            <Field label="Excluded providers">
              <Input value={form.excludedProviders} onChange={(e) => setForm({ ...form, excludedProviders: e.target.value })} />
            </Field>
            <Field label="Allowed destinations" hint="IN, US, UK, EU">
              <Input value={form.destinations} onChange={(e) => setForm({ ...form, destinations: e.target.value })} />
            </Field>
            <Field label="Max listing age (hours)" hint="Freshness requirement">
              <Input value={form.maxAgeHours} onChange={(e) => setForm({ ...form, maxAgeHours: e.target.value })} inputMode="decimal" />
            </Field>
          </div>
          <Button onClick={() => void create()} disabled={saving || !form.name.trim()}>
            {saving ? <Spinner /> : null} Save mandate
          </Button>
        </Card>

        <div className="space-y-4">
          {loading ? (
            <Card className="flex items-center justify-center p-10 text-muted">
              <Spinner className="mr-2" /> Loading mandates…
            </Card>
          ) : mandates.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">
              No mandates yet. Create one on the left — it will govern your shopping plans.
            </Card>
          ) : (
            mandates.map((m) => (
              <Card
                key={m.id}
                className={`p-4 transition-colors ${selectedId === m.id ? "border-accent/50" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{m.name}</h3>
                      {m.active ? <Badge tone="success">active</Badge> : <Badge>inactive</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Budget {money(m.budgetMinor, m.currency)} · min unspent {money(m.minUnspentMinor, m.currency)} ·
                      max {m.maxTotalItems} items · qty ≤ {m.maxQuantityPerItem}
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {m.preferredBrands.length ? `Preferred: ${m.preferredBrands.join(", ")}. ` : ""}
                      {m.excludedBrands.length ? `Excluded: ${m.excludedBrands.join(", ")}. ` : ""}
                      {m.allowedDestinations.length ? `Destinations: ${m.allowedDestinations.join(", ")}.` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant={selectedId === m.id ? "primary" : "outline"} onClick={() => setSelectedId(m.id)}>
                      {selectedId === m.id ? "Selected" : "Select"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(m.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}

          {selectedId ? (
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-semibold">Validate current plan</h2>
              <p className="text-xs text-muted">
                Runs the deterministic engine against the items in your active shopping plan.
              </p>
              <Button onClick={() => void evaluate()} disabled={evaluating}>
                {evaluating ? <Spinner /> : null} Evaluate plan
              </Button>
              {evaluation ? (
                <div className="space-y-2 pt-1">
                  <Badge
                    tone={
                      evaluation.decision === "ALLOW" ? "success" : evaluation.decision === "DENY" ? "danger" : "warn"
                    }
                  >
                    {evaluation.decision}
                  </Badge>
                  <p className="text-xs text-muted">
                    Subtotal {money(evaluation.subtotalMinor, evaluation.currency)} · budget{" "}
                    {money(evaluation.budgetMinor, evaluation.currency)} · remaining{" "}
                    {money(evaluation.remainingMinor, evaluation.currency)} · {evaluation.itemCount} items
                  </p>
                  {evaluation.violations.length > 0 ? (
                    <ul className="space-y-1 text-xs text-danger">
                      {evaluation.violations.map((v, i) => (
                        <li key={i}>
                          <span className="font-mono text-[10px]">{v.code}</span> — {v.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {evaluation.warnings.length > 0 ? (
                    <ul className="space-y-1 text-xs text-warn">
                      {evaluation.warnings.map((w, i) => (
                        <li key={i}>
                          <span className="font-mono text-[10px]">{w.code}</span> — {w.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
