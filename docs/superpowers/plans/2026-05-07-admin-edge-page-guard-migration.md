# Admin Edge Page Guard Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the remaining admin edge pages to the shared page guard helper.

**Architecture:** Server page entrypoints delegate locale validation and admin auth to `setupAdminPage`; page-specific data loading and entity 404 behavior remain local.

**Tech Stack:** Next.js App Router, next-intl, Vitest, Supabase clients.

---

### Task 1: Admin Release Page

**Files:**
- Modify: `src/app/[locale]/admin/releases/page.tsx`

- [x] Replace local locale/admin auth setup with `setupAdminPage`.
- [x] Preserve release query and upload action wiring.

### Task 2: Support Feedback Detail Page

**Files:**
- Modify: `src/app/[locale]/admin/support-feedback/[id]/page.tsx`

- [x] Replace local locale/admin auth setup with `setupAdminPage`.
- [x] Preserve missing feedback `notFound` behavior.

### Task 3: Verification

- [ ] Run focused admin tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit the migration to `main`.
