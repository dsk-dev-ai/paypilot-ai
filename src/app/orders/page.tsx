"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { formatMinor } from "@/lib/money-format";

type Order = {
  id: string;
  state: string;
  currency: string;
  totalMinor: number;
  amountIsEstimate: boolean;
  paymentProvider: string | null;
  items: Array<{ provider: string; title: string; quantity: number }>;
  createdAt: string;
};

const stateTone: Record<string, "neutral" | "info" | "success" | "warn" | "danger"> = {
  CREATED: "neutral",
  PENDING_APPROVAL: "warn",
  APPROVED: "info",
  CAPTURING: "warn",
  PAID: "success",
  FAILED: "danger",
  CANCELED: "neutral",
  REFUNDED: "info",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error.message);
        setOrders(data.orders ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load orders");
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
        <Spinner className="mr-2" /> Loading orders…
      </div>
    );
  }
  if (error) return <ErrorState body={error} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Orders"
        subtitle="One order record per merchant group. External checkouts are recorded as handoffs — self-reported unless paid through Mandate's PayPal."
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="Orders are created when you start checkout from an approved plan. Each merchant becomes its own order."
          action={
            <Link href="/checkout" className="text-xs text-accent hover:underline">
              Go to checkout →
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-line-strong">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={stateTone[o.state] ?? "neutral"}>{o.state}</Badge>
                    {o.amountIsEstimate ? <Badge tone="neutral">estimate</Badge> : null}
                    {o.paymentProvider ? <Badge tone="info">{o.paymentProvider}</Badge> : null}
                  </div>
                  <p className="mt-1.5 truncate text-sm text-text">
                    {o.items.map((it) => `${it.provider}: ${it.title} ×${it.quantity}`).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {o.id} · {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatMinor(o.totalMinor, o.currency)}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
