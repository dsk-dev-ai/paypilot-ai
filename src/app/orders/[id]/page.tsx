"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Card, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatMinor } from "@/lib/money-format";

type OrderDetail = {
  id: string;
  state: string;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  amountIsEstimate: boolean;
  paymentProvider: string | null;
  providerReference: string | null;
  environment: string;
  createdAt: string;
  items: Array<{ title: string; provider: string; quantity: number; unitPriceMinor: number; canonicalUrl: string }>;
};
type Attempt = { id: string; provider: string; status: string; amountMinor: number; currency: string; failureCode: string | null; createdAt: string };
type Handoff = { id: string; provider: string; url: string; state: string; createdAt: string };

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data?.order) throw new Error(data?.error?.message ?? "Order not found");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setOrder(data.order);
        setAttempts(data.paymentAttempts ?? []);
        setHandoffs(data.handoffs ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load order");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading order…
      </div>
    );
  }
  if (error || !order) return <ErrorState body={error ?? "Order not found"} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title={`Order ${order.id.slice(-8)}`}
        subtitle={`Created ${new Date(order.createdAt).toLocaleString()} · ${order.environment}`}
        right={<Badge tone="accent">{order.state}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <ul className="divide-y divide-line/60">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="text-xs text-faint">
                    {it.provider} · qty {it.quantity} · {formatMinor(it.unitPriceMinor, order.currency)} each
                  </p>
                </div>
                <a
                  href={it.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="shrink-0 text-xs text-accent hover:underline"
                >
                  Open ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-2 p-5">
            <h2 className="text-sm font-semibold">Totals</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatMinor(order.subtotalMinor, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>{formatMinor(order.totalMinor, order.currency)}</span>
            </div>
            {order.amountIsEstimate ? (
              <p className="text-[11px] text-faint">
                Estimate — shipping and taxes are determined by each merchant at their own checkout.
              </p>
            ) : null}
          </Card>

          {handoffs.length > 0 ? (
            <Card className="space-y-2 p-5">
              <h2 className="text-sm font-semibold">Merchant handoffs</h2>
              {handoffs.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted">
                    {h.provider} · {h.state === "CONFIRMED" ? "marked complete (self-reported)" : "opened"}
                  </span>
                  <a href={h.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                    Open ↗
                  </a>
                </div>
              ))}
            </Card>
          ) : null}

          {attempts.length > 0 ? (
            <Card className="space-y-2 p-5">
              <h2 className="text-sm font-semibold">Payment attempts</h2>
              {attempts.map((a) => (
                <p key={a.id} className="text-xs text-muted">
                  {a.provider} · {a.status} · {formatMinor(a.amountMinor, a.currency)}
                  {a.failureCode ? ` · ${a.failureCode}` : ""} · {new Date(a.createdAt).toLocaleString()}
                </p>
              ))}
            </Card>
          ) : null}

          <ButtonLink href="/orders" variant="secondary" size="sm">
            ← All orders
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
