import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal, StaggerGroup, StaggerItem, MotionCard } from "@/components/motion/Reveal";

const steps = [
  {
    icon: "✎",
    title: "Describe what you want",
    body: "Natural language or filters. Mandate searches every authorized, configured provider.",
  },
  {
    icon: "⚖",
    title: "Compare real listings",
    body: "Live prices, availability and seller data — attributed to their source, with unknowns labeled as unknown.",
  },
  {
    icon: "🛡",
    title: "Set a spending policy",
    body: "Budget, brands, providers and quantity limits. A deterministic engine validates every plan.",
  },
  {
    icon: "✍",
    title: "Sign the exact cart",
    body: "Approval issues a SHA-256 consent artifact. Any cart change invalidates it and requires re-approval.",
  },
];

const stats = [
  { value: "3", label: "Providers wired" },
  { value: "12", label: "Policy checks" },
  { value: "SHA-256", label: "Cart consent" },
  { value: "0", label: "Unsigned charges" },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="relative mx-auto max-w-3xl text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent/20 blur-[100px]"
        />
        <Reveal>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line glass px-3.5 py-1.5 text-xs text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Verifiable agentic checkout
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Shop across merchants with <span className="text-gradient">consent you can verify</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            Mandate searches authorized product sources, enforces your spending rules, and binds every
            purchase to a human-approved cart hash before PayPal capture — with every claim sourced.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/search" size="lg">
              Start searching
              <span className="transition-transform duration-300 group-hover/btn:translate-x-0.5">→</span>
            </ButtonLink>
            <ButtonLink href="/status" variant="secondary" size="lg">
              Integration status
            </ButtonLink>
          </div>
        </Reveal>
      </section>

      <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <StaggerItem key={s.title}>
            <MotionCard className="h-full">
              <Card className="group h-full p-5" interactive>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent-2/20 text-lg text-accent transition-transform duration-300 group-hover:scale-110">
                  {s.icon}
                </div>
                <span className="text-[11px] font-semibold text-faint">STEP {i + 1}</span>
                <h3 className="mt-1 text-sm font-semibold text-text">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{s.body}</p>
              </Card>
            </MotionCard>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <Card className="p-5 text-center" glass>
              <div className="text-2xl font-semibold text-gradient">{s.value}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <Reveal>
        <Card className="relative overflow-hidden p-6 sm:p-10" glass>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-2/20 blur-[90px]"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <h2 className="text-xl font-semibold sm:text-2xl">
                See what is <span className="text-gradient">actually connected</span>
              </h2>
              <p className="mt-2 text-sm text-muted">
                Providers show honest states — configured, verified, or not connected. Nothing is
                labeled live until a real request has succeeded.
              </p>
            </div>
            <ButtonLink href="/status" variant="outline" size="lg" className="shrink-0">
              View status
            </ButtonLink>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
