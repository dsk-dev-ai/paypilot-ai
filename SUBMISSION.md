# PayPilot AI — Devpost submission

**An AI that can shop. A mandate that keeps it honest.**

PayPilot is an accountable purchasing agent built for the PayPal AI Hackathon. The agent proposes a
purchase, a human-signed mandate decides what is allowed, real PayPal sandbox money moves, digital goods
are delivered instantly, and a tamper-evident receipt lets anyone recompute what happened.

- **Repo:** https://github.com/dsk-dev-ai/paypilot-ai
- **Live demo:** _add your deployed URL here_
- **Video:** _add your 3-minute demo link here_
- **License:** MIT

---

## Inspiration

Agents are getting good at deciding what to buy. They are not getting good at proving they were allowed
to buy it. Every “agentic commerce” demo we saw stopped at a simulated checkout or a redirect to a retailer
that may not even accept PayPal. We wanted a demo where the money is real (sandbox), the delivery is real,
and the authorization is independently verifiable.

The question we built around: **what does a purchase look like when the AI is capable but not trusted?**

## What it does

1. You describe a goal in plain English.
2. The agent proposes a plan using only a fixed, server-side catalog. It cannot invent products.
3. A deterministic mandate engine checks budget, quantity, provider allowlist, destination, and listing
   freshness.
4. You review and approve the exact cart. Approval issues a SHA-256 consent artifact over prices,
   quantities, and line items.
5. Checkout recomputes the hash. If anything changed, the charge is refused.
6. A real PayPal Orders v2 sandbox order is created. After buyer approval, the server captures and verifies
   the payment.
7. Digital goods are delivered instantly with license keys.
8. Every event is appended to a PostgreSQL hash-chained ledger. The verifier re-hashes the consent artifact
   and walks the chain instead of trusting a stored “paid” flag.

The built-in **PayPilot Store** makes this a closed loop: PayPilot is the merchant of record, so PayPal is
the payment rail and delivery is generated server-side after capture.

## How we built it

- **Next.js 16 + React 19 + TypeScript** with a custom dark UI.
- **Prisma 6 + PostgreSQL 16** for plans, mandates, consents, orders, fulfillment, audit, notifications,
  and an append-only hash-chained ledger.
- **Zod** at every boundary: request bodies, consent snapshots, and Gemini JSON output.
- **Google Gemini** (`gemini-3.6-flash`) generates a proposal as JSON with a strict schema. A deterministic
  keyword planner is the fallback, so the demo works without an API key.
- **PayPal Orders v2** creates the order, returns the buyer approval URL, and captures after approval.
- **AG Grid** powers the control room’s order grid.

### Trust design

- The model only sees a compact catalog projection and may only return product ids.
- The server drops unknown ids, clamps quantities, and recomputes the mandate evaluation before persisting.
- Consent is a SHA-256 hash of the canonical cart snapshot plus a decision and expiry.
- Checkout rejects `PRICE_CHANGED`, `CONSENT_MISMATCH`, `CONSENT_EXPIRED`, `CONSENT_CONSUMED`,
  `CONSENT_REVOKED`, and `CONSENT_TAMPERED`.
- Capture is idempotent; a double-loaded return URL cannot charge twice.
- Fulfillment is idempotent and only runs for the built-in store after `PAID`.
- Ledger appends take a Postgres advisory lock so concurrent writes cannot fork the chain.

## How PayPal is used

- Server-side OAuth against the sandbox.
- `POST /v2/checkout/orders` with `intent: CAPTURE`, `NO_SHIPPING`, `PAY_NOW`, and return/cancel URLs.
- Buyer approves on PayPal sandbox.
- The return page calls `POST /api/checkout/paypal/capture`, which fetches the PayPal order, requires
  `APPROVED`, captures it, and requires `COMPLETED` before marking our order `PAID`.
- Then, and only then, digital fulfillment runs.
- The app is **USD-only** because that matches the PayPal sandbox grant used for this build.

## Challenges we ran into

- **The reachability bug:** the original providers only declared `EXTERNAL_CHECKOUT`, so `routeCheckout`
  never selected PayPal. We added a built-in provider with the `PAYPILOT_PAYPAL` capability to make the
  PayPal path real.
- **Consent vs. AI nondeterminism:** regenerating a plan could silently change the cart. We added a
  `confirmed` commit path that persists the exact reviewed lines without a second model call.
- **Idempotency everywhere:** PayPal return URLs get loaded twice; captures retry; fulfillment must not mint
  duplicate license keys. Each layer is idempotent by key.
- **Verifiability without trust:** it is easy to display a green check. We made the verifier recompute the
  consent hash and walk the ledger chain from stored data.

## Accomplishments we are proud of

- A real end-to-end purchase loop with PayPal sandbox capture and instant fulfillment.
- A grounded AI planner with a deterministic fallback and server-side re-validation.
- A receipt verifier that can explain *why* it failed, not just that it failed.
- 127 passing tests (including live-Postgres repository tests), clean typecheck, lint, and production build.

## What we learned

- Agent safety is mostly about **narrowing the action space** and **making the authorization artifact
  verifiable**, not about a better prompt.
- Deterministic checks and AI proposals compose well when the AI is restricted to ids and the server owns
  the money.
- Idempotency is a product feature: it is what makes a payment demo feel trustworthy.

## What's next

- PayPal webhooks for asynchronous capture/dispute events.
- Multi-currency support and merchant onboarding.
- Server-side rendering of downloadable deliverables (signed URLs) instead of demo license keys.
- Per-user persistent accounts and role-scoped mandates.
- A policy simulation mode that shows exactly which constraint would block a proposal.

## Built with

`next.js` `react` `typescript` `tailwindcss` `motion` `prisma` `postgresql` `zod` `paypal-orders-v2`
`google-gemini` `ag-grid` `vitest`

---

## 3-minute demo script

**0:00–0:25 — Problem.** “Agents can decide to buy things. They cannot prove they were allowed to. We built
the accountability layer: a human-signed mandate, real PayPal capture, instant delivery, and a receipt you
can recompute.”

**0:25–1:05 — Agent.** Open `/agent`. Create the $100 demo budget. Paste: “I’m shipping an AI agent and
need a starter kit, a security checklist, and a demo script under $60.” Show the Gemini badge, the three
grounded items, the `ALLOW` evaluation, and the “send to plan” action.

**1:05–1:35 — Human approval.** Open `/plan`. Approve. Show the consent hash and explain that the hash
covers line items, quantities, and prices. Any change invalidates it.

**1:35–2:05 — PayPal.** Open `/checkout`. Start checkout. Show the real sandbox order and the PayPal
approval URL. Approve with a sandbox buyer. Return to the app.

**2:05–2:30 — Delivery.** Show the license keys on the return page and the order detail. Point out that
delivery only ran after PayPal reported `COMPLETED`.

**2:30–3:00 — Proof.** Open `/dashboard`, then `/verify`. Show spend vs budget, delivery, and the ledger
tail. Click through the checks. Close on: “The agent proposes. The mandate decides. The human signs.
PayPal pays. The ledger proves.”

> If a live PayPal approval is not possible during judging, stop after the PayPal order is created. The
> control room and verifier already show the consent and ledger checks passing; only the payment check is
> pending.

---

## Judge quick start

```bash
npm install
cp .env.example .env.local     # add PayPal sandbox + optional Gemini key
docker compose up -d db
npm run db:migrate             # reads .env.local automatically
npm run dev
```

Then open `http://localhost:3000/agent` and create the demo budget.

Full setup, environment table, API surface, and limitations are in [README.md](./README.md).
