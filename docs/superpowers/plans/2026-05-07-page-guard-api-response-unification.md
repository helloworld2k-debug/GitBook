# Page Guard and API Response Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply existing locale/auth page helpers and API JSON response helpers across a low-risk slice of the app without changing UI or behavior.

**Architecture:** Use `resolvePageLocale`, `setupAdminPage`, and `setupUserPage` to remove repeated page setup code. Use `jsonOk` and `jsonError` in tested API routes while preserving response payloads and status codes.

**Tech Stack:** Next.js App Router, TypeScript, next-intl, Supabase, Vitest, Testing Library.

---

## Task 1: Baseline Verification

**Files:**
- No edits.

- [ ] Run `git status --short`; expected clean.
- [ ] Run `npm run lint`; expected exit 0.
- [ ] Run `npm test`; expected all tests pass.
- [ ] Run `npm run build`; expected exit 0.

## Task 2: Public Page Locale Helper Migration

**Files:**
- Modify: `src/app/[locale]/versions/page.tsx`
- Modify: `src/app/[locale]/contributions/page.tsx`
- Modify: `src/app/[locale]/support/page.tsx`
- Modify: `src/app/[locale]/reset-password/page.tsx`
- Test: `tests/unit/release-download-pages.test.tsx`
- Test: `tests/unit/contributions-page.test.tsx`
- Test: `tests/unit/support-page.test.tsx`
- Test: `tests/unit/login-page.test.tsx`

- [ ] Write or confirm tests cover invalid locale, headings, forms, and key links for the target pages.
- [ ] Replace repeated `supportedLocales.includes` + `notFound` + `setRequestLocale` with `resolvePageLocale`.
- [ ] Keep JSX and route behavior unchanged.
- [ ] Run targeted tests:

```bash
npm test -- tests/unit/release-download-pages.test.tsx tests/unit/contributions-page.test.tsx tests/unit/support-page.test.tsx tests/unit/login-page.test.tsx
```

Expected: selected tests pass.

## Task 3: Admin Page Guard Migration

**Files:**
- Modify: `src/app/[locale]/admin/donations/page.tsx`
- Modify: `src/app/[locale]/admin/certificates/page.tsx`
- Modify: `src/app/[locale]/admin/contribution-pricing/page.tsx`
- Test: `tests/unit/admin-pages.test.tsx`
- Test: `tests/unit/admin-contribution-pricing-page.test.tsx`

- [ ] Confirm existing tests cover admin guard calls and page rendering.
- [ ] Replace repeated admin locale/auth setup with `setupAdminPage`.
- [ ] Keep `getAdminShellProps` path arguments unchanged.
- [ ] Run targeted tests:

```bash
npm test -- tests/unit/admin-pages.test.tsx tests/unit/admin-contribution-pricing-page.test.tsx
```

Expected: selected tests pass.

## Task 4: API Response Helper Migration

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/checkout/dodo/route.ts`
- Modify: `src/app/api/license/cloud-sync/activate/route.ts`
- Modify: `src/app/api/license/cloud-sync/heartbeat/route.ts`
- Modify: `src/app/api/license/cloud-sync/release/route.ts`
- Test: existing API route tests.

- [ ] Confirm existing tests assert status codes and JSON bodies.
- [ ] Replace direct `NextResponse.json({ error: message }, { status })` with `jsonError(message, status)` only when the body is `{ error: string }`.
- [ ] Replace direct success responses with `jsonOk(payload, status)` when payloads are plain objects.
- [ ] Keep nested error shapes, such as `{ error: { code, message } }`, unchanged unless a helper supports that exact shape.
- [ ] Run targeted tests:

```bash
npm test -- tests/unit/dodo-checkout.test.ts tests/unit/desktop-entitlement-routes.test.ts tests/unit/desktop-auth-routes.test.ts tests/unit/license-status.test.ts tests/unit/auth-register-route.test.ts
```

If a listed test file does not exist, use `rg` to find the route's current test and run the matching test file instead.

## Task 5: Final Verification and Commit

**Files:**
- No code edits except fixes from verification failures.

- [ ] Run `npm run lint`; expected exit 0.
- [ ] Run `npm test`; expected all tests pass.
- [ ] Run `npm run build`; expected exit 0.
- [ ] Run `git status --short` and `git diff --stat`.
- [ ] Commit to `main` with:

```bash
git add .
git commit -m "refactor: unify page guards and api responses"
```

## Self-Review Notes

- Spec coverage: public pages, admin pages, API routes, and verification are covered.
- Placeholder scan: no placeholders are required to execute this plan.
- Scope check: no UI, route, payload, or schema changes are included.
