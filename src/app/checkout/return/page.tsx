"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, Spinner, SectionTitle } from "@/components/ui/Card";

type Result = { alreadyCaptured?: boolean; order?: { id: string; state: string; totalMinor: number; currency: string }; error?: { message?: string } | string };

function ReturnContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const orderId = params.get("orderId");
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("Verifying payment with PayPal…");

  useEffect(() => {
    let cancelled = false;
    async function capture() {
      if (!orderId || !token) {
        if (!cancelled) {
          setMessage("Missing PayPal token or order id in the return URL.");
          setFailed(true);
          setLoading(false);
        }
        return;
      }
      try {
        const res = await fetch("/api/checkout/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, paypalOrderId: token }),
        });
        const data = (await res.json()) as Result;
        if (cancelled) return;
        if (!res.ok) {
          setFailed(true);
          setMessage(
            typeof data.error === "object" && data.error?.message
              ? data.error.message
              : "PayPal verification failed."
          );
          setResult(data);
        } else {
          setResult(data);
          setMessage(
            data.alreadyCaptured
              ? "Order was already captured — nothing was charged twice."
              : "Payment captured and verified with PayPal (sandbox)."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setFailed(true);
          setMessage(e instanceof Error ? e.message : "Verification failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void capture();
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  return (
    <Card className="max-w-xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        {loading ? <Spinner /> : null}
        <h2 className="text-lg font-semibold">{loading ? "Verifying…" : failed ? "Verification failed" : "Payment verified"}</h2>
        {!loading ? <Badge tone={failed ? "danger" : "success"}>{failed ? "FAILED" : "PAID"}</Badge> : null}
      </div>
      <p className="text-sm text-muted">{message}</p>
      {result?.order ? (
        <p className="text-xs text-faint">
          Mandate order {result.order.id} · state {result.order.state}
        </p>
      ) : null}
      {token ? <p className="text-[11px] text-faint">PayPal order: {token}</p> : null}
      <div className="flex gap-2">
        <Link href="/orders" className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent">
          Orders
        </Link>
        <Link href="/checkout" className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent">
          Checkout
        </Link>
      </div>
    </Card>
  );
}

export default function CheckoutReturnPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle title="PayPal return" subtitle="Capture happens only after PayPal reports buyer approval — verified server-side." />
      <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
        <ReturnContent />
      </Suspense>
    </div>
  );
}
