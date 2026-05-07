# User Page Guard Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate tested authenticated user pages to the shared `setupUserPage` helper without changing UI or behavior.

**Architecture:** Page entrypoints use one helper for locale validation, request locale setup, and auth redirect behavior. Existing pages retain their data loading and entity-level `notFound` handling.

**Tech Stack:** Next.js App Router, next-intl, Vitest, React Testing Library, Supabase clients.

---

### Task 1: Dashboard Guard Test and Migration

**Files:**
- Modify: `tests/unit/dashboard-page.test.tsx`
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [x] Add a focused test assertion that `DashboardPage` calls `setupUserPage("en", "/en/dashboard")`.
- [x] Verify the test fails before implementation.
- [x] Replace local locale/auth setup with `setupUserPage`.
- [x] Run `npm test -- tests/unit/dashboard-page.test.tsx`.

### Task 2: Certificate User Pages

**Files:**
- Modify: `src/app/[locale]/dashboard/certificates/[id]/page.tsx`
- Modify: `src/app/[locale]/dashboard/certificates/latest/page.tsx`
- Modify: `src/app/[locale]/support/feedback/[id]/page.tsx`

- [x] Replace local locale/auth setup with `setupUserPage`.
- [x] Preserve entity-level `notFound` handling.
- [x] Run focused page tests.

### Task 3: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit the migration to `main`.
