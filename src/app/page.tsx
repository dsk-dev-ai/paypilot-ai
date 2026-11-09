import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal, StaggerGroup, StaggerItem, MotionCard } from "@/components/motion/Reveal";

const loop = [
  {
    icon: "🧠",
    title: "Agent plans",
    body: "Gemini proposes only real catalog ids. A deterministic fallback keeps the demo alive without a key.",
  },
  {
    icon: "⚖",
    title: "Mandate decides",
    body: "Budget, quantity, provider allowlist, and freshness are re-checked server-side — not by the model.",
  },
  {
    icon: "✍",
    title: "Human signs",
    body: "Approval locks a SHA-256 consent artifact over the exact cart. Any change invalidates it.",
  },
  {
    icon: "⚡",
    title: "PayPal pays",
    body: "Real Orders v2 sandbox capture. Delivery is generated only after capture is verified.",
  },
];

const stats = [
  { value: "$100", label: "Demo mandate" },
  { value: "SHA-256", label: "Signed cart" },
  { value: "PayPal", label: "Sandbox capture" },
  { value: "0", label: "Unsigned charges" },
];

const demoSteps = [
  { step: "01", label: "Open the store", href: "/store", detail: "12 digital products, USD, instant delivery" },
  { step: "02", label: "Run the agent", href: "/agent", detail: "Describe a goal, review the grounded plan" },
  { step: "03", label: "Sign the mandate", href: "/plan", detail: "Approve the exact cart, get a consent hash" },
  { step: "04", label: "Pay with PayPal", href: "/checkout", detail: "Sandbox capture triggers delivery" },
  { step: "05", label: "Verify the receipt", href: "/verify", detail: "Recompute the hash and walk the ledger" },
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
            Accountable agentic commerce · PayPal sandbox
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            An AI that can shop. A mandate that <span className="text-gradient">keeps it honest</span>.
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            Describe a goal. PayPilot&apos;s agent builds a plan from a real catalog. A human-signed budget
            caps what it can buy. PayPal capture is the only way money moves — and every step lands in a
            tamper-evident ledger.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/agent" size="lg">
              Run the purchasing agent
              <span className="transition-transform duration-300 group-hover/btn:translate-x-0.5">→</span>
            </ButtonLink>
            <ButtonLink href="/store" variant="secondary" size="lg">
              Browse the store
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="outline" size="lg">
              Control room
            </ButtonLink>
          </div>
        </Reveal>
      </section>

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

      <section className="space-y-5">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              The <span className="text-gradient">closed loop</span>
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              No redirect to a retailer that may not accept PayPal. PayPilot is the merchant of record, so
              the payment, delivery, and proof are all real.
            </p>
          </div>
        </Reveal>
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loop.map((s, i) => (
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
      </section>

      <Reveal>
        <Card className="relative overflow-hidden p-6 sm:p-10" glass>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-2/20 blur-[90px]"
          />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">
                Run the <span className="text-gradient">60-second demo</span>
              </h2>
              <p className="mt-2 text-sm text-muted">
                Every step is live. The PayPal capture is the real sandbox Orders v2 API, and the receipt is
                recomputed from stored evidence — not a hard-coded green check.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href="/agent" size="sm">
                  Start with the agent
                </ButtonLink>
                <ButtonLink href="/status" size="sm" variant="outline">
                  Integration status
                </ButtonLink>
              </div>
            </div>
            <ol className="space-y-2">
              {demoSteps.map((d) => (
                <li key={d.step}>
                  <ButtonLink
                    href={d.href}
                    variant="ghost"
                    className="w-full justify-start! border border-line px-3 py-2.5 text-left"
                  >
                    <span className="font-mono text-[11px] text-accent">{d.step}</span>
                    <span className="text-sm font-medium text-text">{d.label}</span>
                    <span className="ml-auto hidden text-[11px] text-faint sm:inline">{d.detail}</span>
                  </ButtonLink>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </Reveal>

      <Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5" interactive>
            <h3 className="text-sm font-semibold">Grounded, not hallucinated</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The model receives a fixed catalog and may only return ids. Unknown ids, over-budget totals, and
              quantity violations are dropped by the server.
            </p>
          </Card>
          <Card className="p-5" interactive>
            <h3 className="text-sm font-semibold">Consent before money</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Checkout recomputes the SHA-256 hash of the approved cart. A mutated price, quantity, or line
              item refuses the charge and demands re-approval.
            </p>
          </Card>
          <Card className="p-5" interactive>
            <h3 className="text-sm font-semibold">Proof after money</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Each order event is appended to a Postgres hash chain under an advisory lock, so tampering is
              detectable and the verifier can show exactly where.
            </p>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
