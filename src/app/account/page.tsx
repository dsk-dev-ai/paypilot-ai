"use client";

import { useEffect, useState } from "react";
import { Badge, Card, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatAge } from "@/lib/money-format";

type AccountData = {
  session: { userId: string; authModel: string };
  counts: { mandates: number; plans: number; orders: number; wishlist: number; unreadNotifications: number };
  integrations: {
    paypal: { label: string; state: string; message: string };
    ai: { label: string; state: string; message: string };
  };
  recentActivity: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

const stateTone: Record<string, "success" | "info" | "neutral" | "warn" | "danger"> = {
  VERIFIED: "success",
  CONFIGURED: "info",
  ACCESS_PENDING: "warn",
  NOT_CONFIGURED: "neutral",
  ERROR: "danger",
};

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) throw new Error(d.error.message);
        setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load account");
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
        <Spinner className="mr-2" /> Loading account…
      </div>
    );
  }
  if (error || !data) return <ErrorState body={error ?? "Failed to load account"} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Account"
        subtitle="Mandate uses an anonymous session — there is no email, password, or retailer login to manage."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Mandates", data.counts.mandates, "/mandate"],
            ["Plans", data.counts.plans, "/plan"],
            ["Orders", data.counts.orders, "/orders"],
            ["Wishlist", data.counts.wishlist, "/wishlist"],
            ["Alerts", data.counts.unreadNotifications, "/notifications"],
          ] as const
        ).map(([label, count, href]) => (
          <a key={label} href={href}>
            <Card className="p-4 transition-colors hover:border-line-strong">
              <p className="text-xs text-faint">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </Card>
          </a>
        ))}
      </div>

      <Card className="space-y-2 p-5">
        <h2 className="text-sm font-semibold">Session</h2>
        <p className="font-mono text-xs text-muted">{data.session.userId}</p>
        <p className="text-xs text-faint">{data.session.authModel}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{data.integrations.paypal.label}</h2>
            <Badge tone={stateTone[data.integrations.paypal.state] ?? "neutral"}>
              {data.integrations.paypal.state}
            </Badge>
          </div>
          <p className="text-xs text-muted">{data.integrations.paypal.message}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{data.integrations.ai.label}</h2>
            <Badge tone={stateTone[data.integrations.ai.state] ?? "neutral"}>{data.integrations.ai.state}</Badge>
          </div>
          <p className="text-xs text-muted">{data.integrations.ai.message}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-xs text-faint">No recorded activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted">
                  <span className="text-faint">{a.type}</span> — {a.message}
                </span>
                <span className="shrink-0 text-faint">{formatAge(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-[11px] text-faint">
        To erase your data, clear this site&apos;s cookies and local storage. See{" "}
        <a href="/help" className="text-accent hover:underline">
          Help & disclosures
        </a>
        . <ButtonLink href="/help" size="sm" variant="ghost" className="ml-1">Help</ButtonLink>
      </p>
    </div>
  );
}
