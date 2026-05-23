# Admin License Code Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin license-code operations workflow with clearer code-management controls, single-code edit/delete actions, safer bulk operations, and focused tests.

**Architecture:** Keep the existing Next.js admin page and Supabase server actions. Add small client helpers only where interaction state is needed, and expose existing action capabilities through focused row-level forms.

**Tech Stack:** Next.js App Router, React 19, next-intl, Supabase admin client, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Lock Existing Gaps With Tests

**Files:**
- Modify: `tests/unit/admin-pages.test.tsx`
- Modify: `tests/unit/admin-license-actions.test.ts`
- Modify: `tests/unit/admin-license-components.test.tsx`

- [x] Add page expectations for a result summary, row edit controls, and row delete controls.
- [x] Add action expectations that `updateTrialCode` can update label, trial days, and channel metadata.
- [x] Add component expectations that bulk delete asks for confirmation before submitting.
- [x] Run targeted tests and confirm the new assertions fail for the current implementation.

### Task 2: Implement Single-Code Operations UI

**Files:**
- Modify: `src/app/[locale]/admin/licenses/page.tsx`
- Modify: `src/app/[locale]/admin/actions/licenses.ts`
- Modify: `src/components/admin/admin-license-bulk-toolbar.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-Hant.json`

- [x] Import and use `updateTrialCode` and `deleteTrialCode` on the license-code rows.
- [x] Add compact editable details for label, channel, and trial days.
- [x] Add a single-code soft-delete form with confirmation.
- [x] Add a management summary near the filters and table.
- [x] Add confirm text to bulk delete.
- [x] Keep paid-duration edit fields disabled from changing duration length.

### Task 3: Verify and Polish

**Files:**
- Modify only files touched by Tasks 1 and 2 if verification exposes issues.

- [x] Run targeted unit tests for license page, actions, and components.
- [x] Run `npm run lint`.
- [x] Run `npm test` and document any baseline failures separately from this work.
- [x] Review the diff for accidental unrelated changes.
