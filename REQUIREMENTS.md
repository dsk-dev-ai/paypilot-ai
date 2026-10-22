# Mandate — Requirements (v1.1.0)

How to run, test, and which API access is needed for each integration.

## Runtime

| Requirement | Version | Check |
|---|---|---|
| Node.js | >= 20 (tested on 24) | `node --version` |
| npm | >= 10 | `npm --version` |
| PostgreSQL | >= 15 (optional for search-only; required for plans/orders) | `docker compose up -d db` |

## Setup

```bash
npm install
cp .env.example .env.local   # fill values — see table below
docker compose up -d db      # local PostgreSQL (or set DATABASE_URL to Supabase)
npm run db:migrate           # prisma migrate deploy + generate
npm run dev                  # http://localhost:3000
```

## Verification commands

```bash
npm test           # vitest unit tests (no network, no live purchases)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production Next.js build
```

All four must exit 0 for a healthy tree.

## Environment variables

Server-only unless marked `NEXT_PUBLIC`. Real values go in `.env.local` (gitignored).
`.env.example` lists every variable name.

| Variable | Used by | Required for | Where to get it |
|---|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal Sandbox checkout | Checkout via PayPal | https://developer.paypal.com/dashboard/applications/sandbox |
| `PAYPAL_ENV` | PayPal mode gate | `sandbox` (never auto-switches to live) | fixed value |
| `PAYPAL_API_BASE` | PayPal endpoint | `https://api-m.sandbox.paypal.com` | fixed value |
| `GEMINI_API_KEY` | AI assistant (Gemini) | NL assistant / recommendations | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | AI model name | default `gemini-2.0-flash` | optional |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | eBay Browse API search | Real eBay product search | https://developer.ebay.com/ → create app → Buy Browse API keys |
| `EBAY_ENV` | eBay environment | `sandbox` or `production` | eBay dev portal |
| `FLIPKART_AFFILIATE_ID` / `FLIPKART_AFFILIATE_TOKEN` | Flipkart Affiliate search | Real Flipkart product search | https://affiliate.flipkart.com/ (account approval required) |
| `DATABASE_URL` | Prisma / PostgreSQL | Persistent plans, orders, audit | Supabase or `docker compose up -d db` |

## External API access — honest status model

Every provider reports one of these states in the UI and at `GET /api/providers`:

| State | Meaning |
|---|---|
| `VERIFIED` | Credentials present and a live request has succeeded this session |
| `CONFIGURED` | Credentials present, not yet verified against the live API |
| `NOT_CONFIGURED` | Missing credentials; feature degrades safely, official external link offered |
| `ACCESS_PENDING` | Account exists but the provider has not approved the required API scope |
| `ERROR` | Credentials present but the last live request failed |

An adapter class existing does **not** count as integration. Nothing in the UI
claims live data unless a live request returned it.

## Integration notes

- **PayPal** — Orders v2 API, server-side OAuth + create/get/capture, buyer
  approval required, capture verifies amount + currency, idempotent on repeat.
  Sandbox only unless `PAYPAL_ENV=production` is set explicitly.
- **eBay Browse API** — product search only (no checkout without separate Buy
  API approval). Requires an eBay developer application; sandbox keys do not
  return production catalog data.
- **Flipkart Affiliate API** — product search + affiliate attribution links.
  Requires an approved affiliate account.
- **Amazon Associates India** — no official public product-search API;
  Mandate links out to amazon.in search URLs only (labeled external).
- **Gemini** — `generateContent` with JSON schema output; all model output is
  schema-validated and grounded against real listing IDs before display.
- No scraping, no login automation, no cart manipulation on retailer sites.

## Database

- Engine: PostgreSQL (Supabase-compatible). Local: `docker compose up -d db`.
- Migrations: `npm run db:migrate`. Schema source of truth: `prisma/schema.prisma`.
- If `DATABASE_URL` is absent the app starts in degraded mode: search works,
  persistence-backed features (plan, orders, wishlist) report `NOT_CONFIGURED`.

## Security baseline

- All external HTTP goes through an SSRF guard: http(s) only, private/loopback/
  link-local/metadata hosts rejected, 10s default timeout.
- Listing URLs are schema-validated to http(s) before they can be rendered.
- Mutation APIs are rate limited (in-memory token buckets); checkout/payment
  actions use a tighter bucket. Multi-instance deployments need a shared store.
- Responses carry `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, and COOP headers; `X-Powered-By` off.
- Every repository query is scoped by the anonymous session `userId`; no
  cross-session reads or writes. No request/response bodies or secrets are logged.
- Anonymous sessions are random 128-bit ids in an httpOnly cookie; there is no
  account/password system in v1.

## v1.0.0 verification (2026-10-20)

| Check | Result |
|---|---|
| `npm test` | 112 tests / 11 files passed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | production build succeeded |
| Production smoke (`next start`) | health DB connected; mandate → plan → approve `ALLOW` → checkout idempotent → handoff confirm → order `PENDING_APPROVAL`; all pages HTTP 200 |
| Live integrations | PayPal sandbox `CONFIGURED` (no live capture during verification); eBay/Flipkart/Gemini `NOT_CONFIGURED` (no credentials) |

## What tests do and do not do

- Unit tests mock all external HTTP (`fetch` is stubbed). No live purchase,
  no live API quota is consumed by `npm test`.
- Live smoke tests are manual and documented in the phase reports.
