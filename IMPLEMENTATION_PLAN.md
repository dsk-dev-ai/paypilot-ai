# PayPilot AI v1.1.0 Implementation Plan

## Current State
- Next.js 16.4.2, TypeScript, Tailwind CSS
- Premium dark UI implemented
- Basic PayPal Sandbox integration with security checks
- Provider abstraction for AI started
- Prisma schema stub exists
- In-memory order store (needs DB)

## Target Architecture
1. Multi-merchant product search (Flipkart, eBay, Amazon India, generic)
2. Normalized ProductListing model
3. Purchase Mandate system with policy engine
4. AI recommendations grounded in real results
5. Multi-merchant cart with capability-aware checkout
6. PostgreSQL + Prisma persistence
7. Enhanced PayPal integration
8. Comprehensive testing

## Implementation Priority
1. Fix any currency issues, improve core types
2. Add multi-merchant provider framework
3. Implement Flipkart/eBay adapters (with graceful fallbacks)
4. Add Purchase Mandate workflow
5. Enhance cart for multi-merchant
6. Improve checkout router
7. Add Prisma with fallback strategy
8. Comprehensive testing
