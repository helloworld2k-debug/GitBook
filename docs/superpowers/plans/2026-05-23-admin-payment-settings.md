# Admin Payment Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-managed Dodo product IDs for test and live checkout while keeping public production checkout pinned to live.

**Architecture:** Add a Supabase table for Dodo product settings, a small payment settings resolver that prefers database rows and falls back to environment variables, and admin form/actions on the contribution pricing page. Checkout and webhook validation use the resolver for the active runtime environment.

**Tech Stack:** Next.js App Router server actions, Supabase, TypeScript, Vitest, React Testing Library.

---

### Task 1: Database And Resolver

**Files:**
- Create: `supabase/migrations/0056_payment_product_settings.sql`
- Create: `tests/unit/payment-product-settings.test.ts`
- Modify: `src/lib/payments/dodo.ts`

- [ ] **Step 1: Write failing tests for database-preferred and env fallback product IDs.**
- [ ] **Step 2: Run `npm test -- --run tests/unit/payment-product-settings.test.ts` and confirm it fails.**
- [ ] **Step 3: Add migration and resolver implementation.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Checkout And Webhook Integration

**Files:**
- Modify: `src/app/api/checkout/dodo/route.ts`
- Modify: `src/app/api/webhooks/dodo/route.ts`
- Modify: `tests/unit/dodo-checkout.test.ts`
- Modify: `tests/unit/dodo-webhook.test.ts`

- [ ] **Step 1: Update tests so live runtime resolves the live product ID through the async resolver.**
- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Await product resolution in checkout and webhook paths.**
- [ ] **Step 4: Run focused tests and confirm pass.**

### Task 3: Admin UI And Save Action

**Files:**
- Modify: `src/app/[locale]/admin/contribution-pricing/page.tsx`
- Modify: `src/app/[locale]/admin/actions/pricing.ts`
- Modify: `src/app/[locale]/admin/actions/validation.ts`
- Modify: `tests/unit/admin-contribution-pricing-page.test.tsx`
- Modify: `tests/unit/admin-actions.test.ts`

- [ ] **Step 1: Add tests for rendering test/live product ID inputs.**
- [ ] **Step 2: Add tests for validating and upserting one product setting.**
- [ ] **Step 3: Run focused tests and confirm failure.**
- [ ] **Step 4: Implement form section and server action.**
- [ ] **Step 5: Run focused tests and confirm pass.**

### Task 4: Docs And Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/production-readiness-status.md`

- [ ] **Step 1: Document database-managed product IDs and env fallback.**
- [ ] **Step 2: Run `npx tsc --noEmit`, focused tests, and `npm run lint`.**
- [ ] **Step 3: Note existing baseline migration duplicate if full `npm test` still fails.**
