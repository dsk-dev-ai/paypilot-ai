"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Spinner } from "@/components/ui/Card";
import { formatAge } from "@/lib/money-format";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error.message);
        setItems(data.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load notifications");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markRead = async (id: string) => {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading notifications…
      </div>
    );
  }
  if (error) return <ErrorState body={error} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Notifications"
        subtitle="Payment captures and checkout events for your own orders. No marketing, no retailer spam."
      />
      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          body="You'll be notified here when a PayPal capture is verified or a checkout handoff is confirmed."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "opacity-70" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={n.readAt ? "neutral" : "accent"}>{n.readAt ? "read" : "new"}</Badge>
                  <Badge tone="neutral">{n.type}</Badge>
                </div>
                <p className="mt-1.5 text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted">{n.body}</p>
                <p className="mt-1 text-[11px] text-faint">{formatAge(n.createdAt)}</p>
              </div>
              {!n.readAt ? (
                <button
                  onClick={() => void markRead(n.id)}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  Mark read
                </button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
