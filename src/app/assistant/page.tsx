"use client";

import { useState } from "react";
import type { ProductListing } from "@/lib/core/listing";
import { ProductCard } from "@/components/ProductCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, Card, SectionTitle, Spinner } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { motion } from "@/components/motion/Reveal";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  source?: string;
  listings?: ProductListing[];
  queries?: string[];
  officialLinks?: Array<{ provider: string; label: string; url: string; reason: string }>;
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, region: "IN", currency: "INR" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Assistant request failed");
      const listings: ProductListing[] = (data.results ?? []).flatMap(
        (r: { listings: ProductListing[] }) => r.listings ?? []
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `${data.reply}\n\n(${data.searches.length} search(es) executed via real provider APIs — source: ${data.source})`,
          source: data.source,
          listings,
          queries: (data.searches ?? []).map((s: { q: string }) => s.q),
          officialLinks: data.officialLinks ?? [],
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant request failed");
    } finally {
      setLoading(false);
    }
  };

  const addToPlan = async (listing: ProductListing) => {
    setNotice(null);
    try {
      const res = await fetch("/api/plan/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: listing.provider, externalId: listing.externalId, region: listing.region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not add to plan");
      setPlanIds((prev) => (prev.includes(listing.id) ? prev : [...prev, listing.id]));
      setNotice("Added to your plan.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not add to plan");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        title="Assistant"
        subtitle="The AI only writes search queries. Every listing below comes from real provider APIs — the assistant cannot invent products."
      />

      <Card className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "noise cancelling headphones under 20000"'
            aria-label="Message to assistant"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? <Spinner /> : null} Send
          </Button>
        </form>
      </Card>

      {error ? (
        <Card className="border-danger/30 bg-danger/5 p-3.5 text-sm text-danger">{error}</Card>
      ) : null}
      {notice ? (
        <Card className="flex items-center justify-between gap-3 border-accent/30 p-3.5 text-sm">
          <span className={notice === "Added to your plan." ? "text-success" : "text-danger"}>{notice}</span>
          <ButtonLink href="/plan" size="sm" variant="secondary">
            View plan
          </ButtonLink>
        </Card>
      ) : null}

      <div className="space-y-4">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="ml-auto max-w-2xl"
            >
              <Card className="p-4">
                <p className="text-sm">{m.text}</p>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="max-w-3xl"
            >
              <Card className="space-y-4 p-4" glass>
                <div className="flex items-center gap-2">
                  <Badge tone={m.source === "gemini" ? "info" : "neutral"}>{m.source ?? "assistant"}</Badge>
                </div>
                <p className="whitespace-pre-line text-sm text-muted">{m.text}</p>
              {m.officialLinks && m.officialLinks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {m.officialLinks.map((l) => (
                    <a
                      key={l.provider}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                      title={l.reason}
                    >
                      {l.label} search ↗
                    </a>
                  ))}
                </div>
              ) : null}
              {m.listings && m.listings.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {m.listings.slice(0, 8).map((l) => (
                    <ProductCard
                      key={l.id}
                      listing={l}
                      onAddToPlan={() => void addToPlan(l)}
                      addedToPlan={planIds.includes(l.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-line bg-surface/40 p-3">
                  <p className="text-xs text-muted">
                    No live listings were returned. Real product data needs at least one product provider
                    configured (eBay or Flipkart) — see{" "}
                    <a href="/status" className="text-accent hover:underline">
                      Status
                    </a>
                    . Meanwhile, run these exact searches on the official sites:
                  </p>
                  {m.queries && m.queries.length > 0 ? (
                    <ul className="space-y-1 text-xs text-faint">
                      {m.queries.map((q) => (
                        <li key={q}>
                          query: <span className="text-muted">“{q}”</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
              </Card>
            </motion.div>
          )
        )}
        {loading ? (
          <Card className="flex items-center gap-2 p-4 text-sm text-muted">
            <Spinner /> Searching real providers…
          </Card>
        ) : null}
        {messages.length === 0 && !loading ? (
          <p className="text-xs text-faint">
            Try: “wireless earbuds under 3000”, “gaming laptop below 80000”, or “office chair for back support”.
          </p>
        ) : null}
      </div>
    </div>
  );
}
