# PayPilot AI

AI-powered commerce and payment orchestration platform for the PayPal AI Hackathon.

## Features
- Premium dark UI with animations
- Verifiable agentic checkout with consent artifacts
- AI assistant with provider abstraction (Gemini) + deterministic fallback
- Purchase flow with PayPal Sandbox (server-side, approval required, capture after verification)
- Multi-merchant plan management with per-merchant checkout routing
- Order tracking and notifications
- Health/status endpoint

## Tech Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Motion, Prisma 6, PostgreSQL
- Zod for validation

## Environment
Copy `.env.example` to `.env.local` and fill server-only values. Never commit secrets.

## Setup
```bash
npm install
cp .env.example .env.local
export $(grep '^DATABASE_URL=' .env.local)
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Testing
```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Security
- Credentials server-only
- Every purchase bound to a human-approved SHA-256 consent artifact
- Price changes invalidate consent and require re-approval
- One intent per merchant, no merchant merging
- PayPal only when configured and supported
- External checkout never captures card details
- No auto-capture; verification required
- Redirects do not mark payment success

## License
MIT License. See [LICENSE](./LICENSE).
