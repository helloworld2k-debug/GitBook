# Certificate Download Guard Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the shared user guard in the protected certificate download route.

**Architecture:** The route keeps format validation local and delegates locale/auth setup to `setupUserPage`.

**Tech Stack:** Next.js route handlers, next-intl, Vitest, Supabase clients.

---

### Task 1: Route Migration

**Files:**
- Modify: `src/app/[locale]/dashboard/certificates/[id]/download/[format]/route.ts`

- [x] Replace local locale validation, request locale setup, and `requireUser` with `setupUserPage`.
- [x] Keep unsupported format handling before auth.
- [x] Preserve SVG response headers and body rendering.

### Task 2: Test Adaptation

**Files:**
- Modify: `tests/unit/certificate-export-route.test.ts`

- [x] Mock `setupUserPage` directly.
- [x] Keep coverage for unauthenticated redirect, ownership 404, SVG output, and unsupported format 404.

### Task 3: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit to `main`.
