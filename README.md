# PayPilot AI

**An AI that can shop. A mandate that keeps it honest.**

PayPilot is an accountable purchasing agent for the PayPal AI Hackathon. You describe a goal. The agent
builds a plan from a real, server-side catalog. A **human-signed spending mandate** caps what it can buy.
A real **PayPal sandbox capture** is the only way money moves. Digital goods are delivered instantly, and
every step is written to a **tamper-evident receipt chain** you can recompute.

No invoice-only mock. No "click here and trust us" success page. The full loop is real.

---

## Why this exists

Agents can now browse, decide, and spend. The missing piece is **accountability**:

- Who authorized the purchase?
- What exactly was approved, at what price and quantity?
- Did the agent change the cart after approval?
- Can a judge verify the receipt without trusting the app?

PayPilot answers all four with deterministic policy checks, SHA-256 cart consent, real PayPal capture,
and a PostgreSQL hash-chained ledger.

---

## 60-second demo

1. **Store** — browse 12 built-in digital products (USD).
2. **Agent** — “I’m shipping an AI agent and need a starter kit, a security checklist, and a demo script
   under $60.” Create the $100 demo budget, review the grounded proposal, send it to the plan.
3. **Plan** — approve the exact cart. A SHA-256 consent artifact binds the line items, quantities, and
   prices.
4. **Checkout** — the server recomputes that hash, creates a real PayPal Orders v2 sandbox order, and
   sends you to PayPal.
5. **Return** — after buyer approval, the server captures the payment, verifies it, generates license
   keys, and appends receipts.
6. **Control Room + Verify** — see spend vs budget, delivery state, and the ledger. “Verify” re-hashes the
   consent artifact and walks the whole chain.

> The `$100` budget, `paypilot` provider allowlist, and `US` destination are the demo defaults. Edit or
> create mandates under **Policy** to change them.

---

## Architecture

```
Browser
  │  goal
  ▼
/agent  ──►  Gemini (optional)  ──►  proposal (catalog ids only)
  │                                      │
  │        deterministic fallback  ◄─────┘
  ▼
draft plan  ──►  /plan approve  ──►  mandate engine (budget, qty, provider, freshness)
  │                                      │
  │                               SHA-256 consent artifact
  ▼
/checkout  ──►  recompute hash + verify consent binding
  │
  ├─ paypilot  ──►  PayPal Orders v2 (sandbox)  ──►  buyer approves  ──►  capture
  │                                                                        │
  │                                                              instant digital delivery
  │                                                                        │
  └─ external merchant  ──►  recorded handoff to the merchant's own checkout
                                                                           │
                                                             PostgreSQL hash-chained ledger
                                                                           │
                                                                    /verify recomputes
```

---

## What is actually real

| Claim | Implementation |
| --- | --- |
| AI plans a purchase | Gemini `generateContent` with a fixed catalog and strict JSON schema; deterministic keyword planner fallback |
| AI cannot invent products | Server drops any product id not in the catalog and re-clamps quantities |
| Human authorizes | `/api/plan/approve` writes a SHA-256 consent artifact over the exact cart |
| Cart cannot change silently | `/api/checkout` recomputes the hash and rejects mismatches, expired, consumed, or revoked consents |
| Money moves | PayPal Orders v2 `POST /v2/checkout/orders` then `POST /capture` in the sandbox |
| Delivery happens only after payment | `fulfillOrder()` runs after capture and is idempotent per order |
| Receipt cannot be quietly edited | Every event is appended to a Postgres hash chain under an advisory lock; `/api/verify` re-derives it |

### Honest limitations

- PayPal sandbox only; this repo is not configured for live money.
- The PayPal integration is **USD-only** (`PAYPAL_SUPPORTED_CURRENCIES = ["USD"]`).
- Payment confirmation uses the buyer return URL plus a server-side PayPal verification call. There is no
  webhook in this build.
- External retailers (eBay, Flipkart, Amazon adapters) are **handoffs**, not automated checkouts. The
  built-in PayPilot Store is the closed-loop demo.
- Identity is an anonymous session cookie; this is a hackathon demo, not an auth product.
- Rate limiting is in-memory and per-instance.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind CSS v4**, **Motion**, custom dark UI
- **Prisma 6** + **PostgreSQL 16**
- **Zod** for all request and model-output validation
- **AG Grid** for the control-room order grid
- **Google Gemini** (`gemini-3.6-flash` by default) with a deterministic fallback
- **PayPal Orders v2** REST API (sandbox)

---

## Local setup

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```dotenv
APP_BASE_URL=http://localhost:3000

PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash

DATABASE_URL=postgresql://paypilot:paypilot@localhost:5432/paypilot?schema=public
```

- PayPal credentials: <https://developer.paypal.com/dashboard/applications/sandbox>
- Gemini key: <https://aistudio.google.com/apikey>

`GEMINI_API_KEY` is optional. Without it the agent uses the deterministic planner. PayPal credentials are
required for the live payment step.

### 3. Start Postgres and migrate

```bash
docker compose up -d db
npm run db:migrate
```

`db:migrate` loads `.env.local` for you (Next.js does this automatically; the Prisma CLI does not, so
`scripts/run-with-env.mjs` bridges the gap). It applies every migration and regenerates the client.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>, go to **Agent**, and create the demo budget.

For a deployed demo, set `APP_BASE_URL` to the public HTTPS URL so PayPal can return the buyer there.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_BASE_URL` | Recommended | Absolute base for PayPal return/cancel URLs and canonical store links |
| `PAYPAL_CLIENT_ID` | Yes for payment | PayPal REST app client id |
| `PAYPAL_CLIENT_SECRET` | Yes for payment | PayPal REST app secret |
| `PAYPAL_ENV` | No | `sandbox` (default) or `production` |
| `PAYPAL_API_BASE` | No | Defaults to `https://api-m.sandbox.paypal.com` |
| `GEMINI_API_KEY` | Optional | Enables the Gemini planner; otherwise deterministic fallback |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.6-flash` |
| `EBAY_*`, `FLIPKART_*` | Optional | External search adapters; not required for the demo |

Secrets are server-only. `.env.local` is git-ignored; never commit it.

---

## Demo script (3 minutes)

1. **Home** — state the thesis: the agent proposes, the mandate decides, the human signs, PayPal pays,
   the ledger proves.
2. **Agent** — create the $100 demo budget. Paste the example goal. Show the Gemini badge, the three
   grounded items, and the `ALLOW` evaluation. Send to plan.
3. **Plan** — approve. Show the consent hash. Point out that changing a quantity would invalidate it.
4. **Checkout** — start checkout. Show the server-created PayPal sandbox order and approve URL.
5. **PayPal** — approve with a sandbox buyer account. Return to the app.
6. **Delivery** — show the license keys on the return page or order detail.
7. **Control Room** — show spend vs budget, delivery status, and the ledger tail.
8. **Verify** — open the receipt, show every check green, and explain that the page re-hashes the consent
   artifact and re-walks the chain instead of trusting a stored boolean.

If you cannot complete a PayPal approval live, stop after step 4 and show the control room and verifier
with the pending order — the consent and ledger checks already pass.

---

## API surface

| Route | What it does |
| --- | --- |
| `GET /api/catalog` | Built-in product catalog + PayPal/AI status |
| `POST /api/demo/bootstrap` | Creates the $100 demo mandate for this session |
| `POST /api/agent/plan` | Grounded proposal (`commit:false`) or persist reviewed lines (`commit:true`) |
| `GET/POST /api/plan/items` | Add a catalog listing to the draft plan |
| `POST /api/plan/approve` | Evaluate the mandate and issue a SHA-256 consent artifact |
| `POST /api/checkout` | Verify consent, create orders, create PayPal sandbox orders |
| `POST /api/checkout/paypal/capture` | Verify + capture, fulfill digital goods, append receipts |
| `GET /api/orders/[id]` | Order, attempts, handoffs, fulfillment |
| `GET /api/dashboard` | Orders, mandates, ledger, verification, summary |
| `GET /api/verify?orderId=` | Recompute consent hash and ledger chain for one order |
| `GET /api/health` | Provider and integration health |

---

## Testing and verification

```bash
npm test            # 127 tests, including optional live-Postgres repository tests
npm run typecheck
npm run lint
npm run build
```

The repository smoke tests are skipped automatically when `DATABASE_URL` is absent.

---

## Project structure

```
src/
  app/
    agent/                 # grounded purchasing agent UI
    store/                 # built-in digital merchant
    plan/                  # human review + approval
    checkout/              # consent-gated checkout + PayPal return
    dashboard/             # AG Grid control room
    verify/                # receipt verifier
    api/                   # route handlers
  lib/
    ai/purchase.ts         # Gemini planner + deterministic fallback
    catalog/products.ts    # 12-product USD catalog
    mandate/               # policy engine, consent hashing, ledger primitives
    checkout/router.ts     # PAYPILOT_PAYPAL vs EXTERNAL_CHECKOUT routing
    db/                    # Prisma repositories, fulfillment, hash-chained ledger
    providers/paypilot.ts  # built-in merchant with PayPal capability
  modules/payments/        # PayPal Orders v2 client/config
prisma/
  schema.prisma
  migrations/
```

---

## Security notes

- PayPal and Gemini credentials are read server-side only.
- The model never receives payment details and cannot create an order.
- Every purchase is bound to a human-approved SHA-256 consent artifact.
- Price, quantity, provider, and freshness are re-checked by the deterministic engine.
- Checkout refuses changed, expired, consumed, revoked, or tampered consents.
- Capture is idempotent; a refreshed return URL cannot charge twice.
- Digital fulfillment is idempotent and only runs for the built-in store after `PAID`.
- The ledger is append-only from the app’s perspective and verified by recomputation.

## License

MIT License. See [LICENSE](./LICENSE).
