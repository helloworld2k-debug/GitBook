# Fallback Locale Helper Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete shared fallback locale adoption for non-page flows.

**Architecture:** Routes and helpers that intentionally fall back unsupported locale input to English use `getActionLocale`.

**Tech Stack:** Next.js route handlers, TypeScript, Vitest.

---

### Task 1: Admin Feedback Return Paths

**Files:**
- Modify: `src/lib/admin/feedback.ts`
- Create: `tests/unit/admin-feedback.test.ts`

- [x] Add direct tests for safe and unsafe admin return paths.
- [x] Delegate locale normalization to `getActionLocale`.

### Task 2: Dodo Checkout Locale

**Files:**
- Modify: `src/app/api/checkout/dodo/route.ts`

- [x] Replace local checkout locale helper with `getActionLocale`.
- [x] Preserve checkout, login redirect, cancel URL, and return URL behavior.

### Task 3: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit to `main`.
