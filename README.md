# PayPilot AI

AI-powered commerce and payment orchestration platform for the PayPal AI Hackathon.

## Features (Day 1)
- Responsive dashboard shell
- Typed product catalog with labeled demo data
- Shopping assistant (budget-aware recommendations)
- Deterministic budget/order-total calculations
- Typed order states and validation
- Basic unit tests

## Tech Stack
- Next.js (App Router), TypeScript, Tailwind CSS

## Setup
```bash
npm install
cp .env.example .env.local  # fill server-only PayPal creds when ready
npm run dev
```

## Testing
```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## PayPal Integration
Not implemented yet. Will use official PayPal Sandbox API (server-side auth, create order, buyer approval, capture, verify). Credentials stay on server; no auto-capture; amounts validated against catalog.

## Notes
- No secrets committed
- Modular monolith structure under `src/modules/`
- AI must not invent prices or report unverified payment success
