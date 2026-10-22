"use client";

import { useEffect, useState } from "react";
import { Badge, Card, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";

type Capability = {
  search: boolean;
  productDetails: boolean;
  checkout: string[];
  supportedCurrencies: string[];
  markets: string[];
};

type ProviderInfo = {
  id: string;
  label: string;
  state: string;
  capabilities: Capability;
  message: string;
  officialUrl?: string;
  docsUrl?: string;
  lastVerifiedAt?: string;
  lastError?: { code: string; message: string; at: string };
};

type HealthPayload = {
  status?: string;
  configured?: Record<string, boolean>;
  database?: string;
};

type LedgerEntry = {
  id: string;
  seq: number;
  type: string;
  subjectId: string | null;
  hash: string;
  createdAt: string;
};

type LedgerVerification = {
  ok: boolean;
  count: number;
  head: string;
  brokenAtSeq: number | null;
  reason: string | null;
};

const stateTone: Record<string, "success" | "info" | "neutral" | "warn" | "danger"> = {
  VERIFIED: "success",
  CONFIGURED: "info",
  ACCESS_PENDING: "warn",
  NOT_CONFIGURED: "neutral",
  ERROR: "danger",
};

function yesNo(v: boolean) {
  return v ? "yes" : "no";
}

export default function StatusPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ai, setAi] = useState<ProviderInfo | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerVerification, setLedgerVerification] = useState<LedgerVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/providers").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()).catch(() => ({})),
      fetch("/api/account").then((r) => r.json()).catch(() => ({})),
      fetch("/api/ledger").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([prov, h, acct, led]) => {
        if (cancelled) return;
        const all: ProviderInfo[] = [...(prov.search ?? []), ...(prov.checkout ?? []), ...(prov.support ?? [])];
        const seen = new Set<string>();
        const dedup = all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
        setProviders(dedup);
        setHealth(h);
        setAi(acct?.integrations?.ai ?? null);
        setLedger(led?.entries ?? []);
        setLedgerVerification(led?.verification ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load status");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading integration status…
      </div>
    );
  }
  if (error) return <ErrorState body={error} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Integration status"
        subtitle="Honest, server-reported state for every integration. NOT_CONFIGURED means the credential is absent — not that the provider is 'coming soon'."
      />

      <Card className="grid gap-3 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs text-faint">App</p>
          <p className="text-sm font-medium">{health?.status ?? "running"}</p>
        </div>
        <div>
          <p className="text-xs text-faint">Database</p>
          <p className="text-sm font-medium">{health?.database ?? "unknown"}</p>
        </div>
        <div>
          <p className="text-xs text-faint">Assistant</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{ai?.label ?? "Assistant"}</p>
            {ai ? <Badge tone={stateTone[ai.state] ?? "neutral"}>{ai.state}</Badge> : null}
          </div>
          {ai ? <p className="mt-1 text-[11px] text-faint">{ai.message}</p> : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.id} className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{p.label}</h2>
                <Badge tone={stateTone[p.state] ?? "neutral"}>{p.state}</Badge>
              </div>
              {p.docsUrl ? (
                <a href={p.docsUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent hover:underline">
                  docs ↗
                </a>
              ) : null}
            </div>
            <p className="text-xs text-muted">{p.message}</p>
            {p.lastError ? (
              <p className="text-[11px] text-danger">
                last error: {p.lastError.code} — {p.lastError.message}
              </p>
            ) : null}
            <table className="w-full text-left text-[11px]">
              <tbody className="divide-y divide-line/50">
                <tr>
                  <td className="py-1 pr-2 text-faint">search</td>
                  <td>{yesNo(p.capabilities.search)}</td>
                  <td className="py-1 pr-2 text-faint">product details</td>
                  <td>{yesNo(p.capabilities.productDetails)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-faint">checkout</td>
                  <td colSpan={3}>{p.capabilities.checkout.join(", ") || "none"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2 text-faint">currencies</td>
                  <td>{p.capabilities.supportedCurrencies.join(", ") || "—"}</td>
                  <td className="py-1 pr-2 text-faint">markets</td>
                  <td>{p.capabilities.markets.join(", ") || "—"}</td>
                </tr>
              </tbody>
            </table>
            {p.officialUrl ? (
              <a href={p.officialUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent hover:underline">
                {p.label} official site ↗
              </a>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Consent ledger</h2>
            <p className="text-xs text-muted">
              Append-only SHA-256 chain. Each entry commits to the previous hash.
            </p>
          </div>
          {ledgerVerification ? (
            <Badge tone={ledgerVerification.ok ? "success" : "danger"}>
              {ledgerVerification.ok ? "CHAIN VERIFIED" : "CHAIN BROKEN"} · {ledgerVerification.count}
            </Badge>
          ) : (
            <Badge tone="neutral">UNAVAILABLE</Badge>
          )}
        </div>
        {ledger.length > 0 ? (
          <ul className="divide-y divide-line/60 text-[11px]">
            {ledger.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-10 shrink-0 font-mono text-faint">#{entry.seq}</span>
                <span className="font-medium">{entry.type}</span>
                <span className="text-faint">{entry.subjectId?.slice(0, 14) ?? "—"}</span>
                <code className="ml-auto font-mono text-[10px] text-accent">{entry.hash.slice(0, 16)}…</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-faint">No ledger entries yet. Approve a plan to create the first one.</p>
        )}
        {ledgerVerification?.reason ? (
          <p className="text-[11px] text-danger">
            Broken at seq {ledgerVerification.brokenAtSeq}: {ledgerVerification.reason}
          </p>
        ) : null}
      </Card>

      <Card className="p-5 text-[11px] text-faint">
        States: VERIFIED = a real end-to-end call succeeded in this environment. CONFIGURED = credentials
        present, not yet verified end-to-end. NOT_CONFIGURED = required environment variables are missing.
        ERROR = the integration is blocked or failing. Nothing on this page is simulated.
      </Card>
    </div>
  );
}
