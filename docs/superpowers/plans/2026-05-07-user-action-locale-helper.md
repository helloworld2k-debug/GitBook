# User Action Locale Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize safe locale handling for user-facing server actions.

**Architecture:** A shared i18n helper validates action locale inputs and returns a fallback-safe locale for redirect and auth path construction.

**Tech Stack:** Next.js server actions, Vitest, TypeScript.

---

### Task 1: Locale Helper

**Files:**
- Create: `src/lib/i18n/action-locale.ts`
- Create: `tests/unit/action-locale.test.ts`

- [x] Add failing tests for supported and unsupported locales.
- [x] Implement `getActionLocale`.
- [x] Verify helper tests pass.

### Task 2: User Action Migration

**Files:**
- Modify: `src/app/[locale]/dashboard/actions.ts`
- Modify: `src/app/[locale]/support/actions.ts`
- Modify: `src/app/[locale]/notifications/actions.ts`
- Modify: `src/app/[locale]/reset-password/actions.ts`

- [x] Replace local safe-locale helpers with `getActionLocale`.
- [x] Preserve redirect destinations and auth paths.
- [x] Run focused action tests.

### Task 3: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit the helper migration to `main`.
