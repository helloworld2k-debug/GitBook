# Public Page Locale Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish locale helper adoption for remaining low-risk public pages.

**Architecture:** Public pages use shared helpers for locale validation and request locale setup while preserving existing redirect/fallback contracts.

**Tech Stack:** Next.js App Router, next-intl, Vitest, React Testing Library.

---

### Task 1: Public Page Migration

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/donate/page.tsx`

- [x] Use `resolvePageLocale` in login and home pages.
- [x] Use `getActionLocale` for donate redirect fallback behavior.
- [x] Preserve callback, release, and redirect behavior.

### Task 2: Tests

**Files:**
- Modify: `tests/unit/login-page.test.tsx`

- [x] Update login page mock to expose `setRequestLocale`.
- [x] Run focused public page tests.

### Task 3: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit to `main`.
