# PayPilot AI

AI-powered commerce and payment orchestration platform for the PayPal AI Hackathon.

## Features
- Premium dark UI with animations
- Trusted catalog (USD)
- AI assistant with provider abstraction (Gemini/Groq) + deterministic fallback
- Purchase flow with PayPal Sandbox (server-side, approval required, capture after verification)
- Order listing from API
- Health/status endpoint

## Tech Stack
- Next.js (App Router), TypeScript, Tailwind CSS, Prisma (schema prepared), PostgreSQL (Supabase compatible)

## Environment
Copy `.env.example` to `.env.local` and fill server-only values. Never commit secrets.

## Setup
```bash
npm install
cp .env.example .env.local
npx prisma generate  # when DATABASE_URL is set
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
- Amount/currency verified against catalog
- Order association required
- No auto-capture
- Redirects do not mark payment success

## License
MIT License. See [LICENSE](./LICENSE).
