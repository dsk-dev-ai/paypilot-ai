"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Badge, Card, SectionTitle, Spinner } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatMinor } from "@/lib/money-format";
import type { OrderRow } from "@/components/dashboard/OrdersGrid";

const OrdersGrid = dynamic(() => import("@/components/dashboard/OrdersGrid").then((m) => m.OrdersGrid), {
  ssr: false,
  loading: () => (
    <div className="flex h-[430px] items-center justify-center rounded-2xl border border-line text-sm text-muted">
      <Spinner className="mr-2" /> Loading control room…
    </div>
  ),
});

type DashboardOrder = {
  id: string;
  state: string;
  currency: string;
  totalMinor: number;
  items: Array<{ title: string; provider: string; quantity: number }>;
  createdAt: string;
  fulfillment: { status: string; itemCount: number } | null;
};

type LedgerEntry = {
  seq: number;
  type: string;
  subjectId: string | null;
  hash: string;
  createdAt: string;
};

type Dashboard = {
  orders: DashboardOrder[];
  ledger: LedgerEntry[];
  verification: { ok: boolean; count: number; brokenAtSeq?: number | null };
  summary: {
    currency: string;
    orderCount: number;
    paidCount: number;
    fulfilledCount: number;
    activeMandates: number;
    totalSpentMinor: number;
    totalBudgetMinor: number;
    remainingMinor: number;
    ledgerCount: number;
    ledgerOk: boolean;
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then(async (res) => {
        if (res.status === 503) {
          if (!cancelled) setNotConfigured(true);
          return null;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load the control room");
        return body as Dashboard;
      })
      .then((body) => {
        if (body && !cancelled) setData(body);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the control room");
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
        <Spinner className="mr-2" /> Loading control room…
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionTitle title="Agent control room" subtitle="Live spend, delivery, and tamper-evident ledger." />
        <Card className="space-y-3 border-warn/30 bg-warn/5 p-6 text-sm">
          <p className="font-semibold text-warn">Postgres is not configured.</p>
          <p className="text-muted">
            The control room reads real orders, mandates, and the ledger. Start the demo database with{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-text">docker compose up -d db</code>, set{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-text">DATABASE_URL</code> in{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-text">.env.local</code>, and run{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 text-text">npm run db:dev</code>.
          </p>
          <ButtonLink href="/agent" size="sm" variant="secondary">
            Back to the agent
          </ButtonLink>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionTitle title="Agent control room" subtitle="Live spend, delivery, and tamper-evident ledger." />
        <Card className="border-danger/30 bg-danger/5 p-6 text-sm text-danger">{error ?? "No data."}</Card>
      </div>
    );
  }

  const { summary } = data;
  const rows: OrderRow[] = data.orders.map((o) => ({
    id: o.id,
    shortId: o.id.slice(-8),
    state: o.state,
    totalMinor: o.totalMinor,
    currency: o.currency,
    items: o.items.reduce((acc, it) => acc + it.quantity, 0),
    providers: Array.from(new Set(o.items.map((it) => it.provider))).join(", "),
    fulfillment: o.fulfillment
      ? `${o.fulfillment.status} · ${o.fulfillment.itemCount} item(s)`
      : o.state === "PAID"
        ? "pending delivery"
        : "—",
    createdAt: o.createdAt,
  }));

  const usedPct = summary.totalBudgetMinor
    ? Math.min(100, Math.round((summary.totalSpentMinor / summary.totalBudgetMinor) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Agent control room"
        subtitle="Every order, mandate, and ledger append in one place. Click a row to inspect the receipt."
        right={
          <div className="flex items-center gap-2">
            <Badge tone={summary.ledgerOk ? "success" : "danger"}>
              {summary.ledgerOk ? `ledger intact · ${summary.ledgerCount}` : "ledger broken"}
            </Badge>
            <ButtonLink href="/verify" size="sm" variant="secondary">
              Verify a receipt
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5" glass>
          <p className="text-xs text-faint">Spent against budget</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatMinor(summary.totalSpentMinor, summary.currency)}
            <span className="ml-1 text-sm font-normal text-faint">
              / {formatMinor(summary.totalBudgetMinor, summary.currency)}
            </span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 transition-all"
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </Card>
        <Card className="p-5" glass>
          <p className="text-xs text-faint">Orders</p>
          <p className="mt-1 text-2xl font-semibold">{summary.orderCount}</p>
          <p className="mt-1 text-xs text-muted">{summary.paidCount} captured · {summary.fulfilledCount} delivered</p>
        </Card>
        <Card className="p-5" glass>
          <p className="text-xs text-faint">Active mandates</p>
          <p className="mt-1 text-2xl font-semibold">{summary.activeMandates}</p>
          <p className="mt-1 text-xs text-muted">Budgets enforced per order</p>
        </Card>
        <Card className="p-5" glass>
          <p className="text-xs text-faint">Remaining budget</p>
          <p className="mt-1 text-2xl font-semibold text-gradient">
            {formatMinor(summary.remainingMinor, summary.currency)}
          </p>
          <p className="mt-1 text-xs text-muted">{usedPct}% used</p>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Orders</h2>
          <span className="text-[11px] text-faint">AG Grid · live data from Postgres</span>
        </div>
        <OrdersGrid rows={rows} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ledger tail</h2>
            <Badge tone={data.verification.ok ? "success" : "danger"}>
              {data.verification.ok ? "hash chain valid" : `broken at #${data.verification.brokenAtSeq}`}
            </Badge>
          </div>
          {data.ledger.length === 0 ? (
            <p className="text-xs text-faint">No ledger entries yet. Approve a plan and capture a payment.</p>
          ) : (
            <ul className="space-y-2">
              {data.ledger.slice(0, 8).map((entry) => (
                <li key={entry.seq} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-faint">#{entry.seq}</span>
                    <Badge tone="neutral">{entry.type}</Badge>
                  </span>
                  <code className="truncate text-[10px] text-faint">{entry.hash.slice(0, 16)}…</code>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-2 p-4 text-xs text-muted">
          <h2 className="text-sm font-semibold text-text">How to read this room</h2>
          <p>
            <span className="text-success">PAID</span> means PayPal reported capture. A{" "}
            <span className="text-text">delivery</span> record is only created after that capture, and the
            same request appends an <code className="text-text">ORDER_FULFILLED</code> receipt to the hash
            chain.
          </p>
          <p>
            Click any order to see its consent hash, payment attempts, and license keys. Then open{" "}
            <span className="text-accent">Verify</span> to recompute the evidence instead of trusting a flag.
          </p>
        </Card>
      </div>
    </div>
  );
}
