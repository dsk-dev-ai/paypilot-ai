import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-line text-muted border-line",
  accent: "bg-accent/12 text-accent border-accent/30",
  success: "bg-success/12 text-success border-success/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  danger: "bg-danger/12 text-danger border-danger/30",
  info: "bg-accent-2/12 text-accent-2 border-accent-2/30",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  glass = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  glass?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line ${
        glass ? "glass" : "bg-card/70 backdrop-blur-sm"
      } ${interactive ? "gradient-border hover-lift" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {title.split(" ").length === 1 ? (
            title
          ) : (
            <>
              {title.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="text-gradient">{title.split(" ").slice(-1)}</span>
            </>
          )}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted max-w-2xl">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="p-10 text-center animate-fade-up" interactive>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-accent-2/20 text-xl text-accent animate-float">
        ◎
      </div>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({ title = "Something went wrong", body, onRetry }: { title?: string; body: string; onRetry?: () => void }) {
  return (
    <Card className="p-8 border-danger/30 bg-danger/5 text-center animate-fade-up">
      <h3 className="text-base font-semibold text-danger">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-line-strong px-4 py-2 text-sm text-text hover:border-accent hover:text-accent transition-colors"
        >
          Try again
        </button>
      ) : null}
    </Card>
  );
}
