# Admin Action Locale Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the shared action locale helper inside admin action validation.

**Architecture:** Admin action modules continue importing `getSafeLocale`; the validation module delegates locale normalization to `getActionLocale`.

**Tech Stack:** Next.js server actions, Vitest, TypeScript.

---

### Task 1: Delegate Admin Locale Normalization

**Files:**
- Modify: `src/app/[locale]/admin/actions/validation.ts`

- [x] Replace direct supported locale checks with `getActionLocale`.
- [x] Keep the public `getSafeLocale` function name.

### Task 2: Verification

- [ ] Run focused admin action tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit to `main`.
