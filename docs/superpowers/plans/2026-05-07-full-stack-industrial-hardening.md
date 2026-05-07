# Full Stack Industrial Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the GitBook AI website toward industrial-grade maintainability, reliability, and verification while preserving all current UI, layout, localized content, routes, and frontend/backend behavior.

**Architecture:** Make behavior-preserving internal refactors behind existing contracts. Start with verification guardrails, then split the large admin server action module into domain modules, add small page setup helpers, harden API error helpers, and finish with full lint/test/build verification.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, next-intl, Supabase, Dodo Payments, Vitest, Testing Library, Playwright.

---

## File Structure

- Create: `src/app/[locale]/admin/actions/validation.ts` for shared FormData parsing, bounds, locale, URL, date, and file helpers.
- Create: `src/app/[locale]/admin/actions/audit.ts` for admin audit log insertion.
- Create: `src/app/[locale]/admin/actions/donations.ts` for `addManualDonation` and certificate revocation actions.
- Create: `src/app/[locale]/admin/actions/notifications.ts` for notification actions.
- Create: `src/app/[locale]/admin/actions/pricing.ts` for contribution pricing actions.
- Create: `src/app/[locale]/admin/actions/support.ts` for support contact and feedback actions.
- Create: `src/app/[locale]/admin/actions/releases.ts` for software release actions.
- Create: `src/app/[locale]/admin/actions/licenses.ts` for trial/license actions.
- Create: `src/app/[locale]/admin/actions/users.ts` for user, device, role, deletion, and bulk actions.
- Modify: `src/app/[locale]/admin/actions.ts` into a `"use server"` compatibility barrel that re-exports the existing action names.
- Create: `src/lib/i18n/page-locale.ts` for locale validation plus `setRequestLocale`.
- Create: `src/lib/auth/page-guards.ts` for repeated localized admin/user page setup.
- Create: `src/lib/api/responses.ts` for stable JSON error/success route helpers.
- Test: Add focused tests for new helpers while keeping existing admin/page/API tests as regression coverage.

## Task 1: Establish Baseline Guardrails

**Files:**
- Read: `docs/superpowers/specs/2026-05-07-full-stack-industrial-hardening-design.md`
- Read: `git status --short`
- No production edits in this task.

- [ ] **Step 1: Record the dirty worktree boundary**

Run:

```bash
git status --short
```

Expected: shows existing dirty files, including prior admin/pricing edits and recent navigation/footer edits. Do not revert them.

- [ ] **Step 2: Run baseline lint**

Run:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 3: Run baseline tests**

Run:

```bash
npm test
```

Expected: all current Vitest tests pass.

- [ ] **Step 4: Run baseline build**

Run:

```bash
npm run build
```

Expected: Next.js production build exits 0.

## Task 2: Extract Admin Action Validation Helpers

**Files:**
- Create: `src/app/[locale]/admin/actions/validation.ts`
- Modify: `src/app/[locale]/admin/actions.ts`
- Test: `tests/unit/admin-actions.test.ts`
- Test: `tests/unit/admin-license-actions.test.ts`
- Test: `tests/unit/admin-contribution-pricing-page.test.tsx`

- [ ] **Step 1: Write failing helper tests**

Add focused tests to `tests/unit/admin-actions.test.ts` for behavior currently embedded in `admin/actions.ts`: safe locale fallback, positive integer validation, discount percent validation, bounded strings, optional HTTPS URL validation, and support contact value validation.

Run:

```bash
npm test -- tests/unit/admin-actions.test.ts
```

Expected: fails because the new helper module does not exist or helpers are not exported.

- [ ] **Step 2: Create `validation.ts`**

Move these helpers and constants from `src/app/[locale]/admin/actions.ts` into `src/app/[locale]/admin/actions/validation.ts`:

```ts
export const MAX_REASON_LENGTH = 500;
export const MAX_MANUAL_REFERENCE_LENGTH = 120;
export const MAX_RELEASE_NOTES_LENGTH = 4000;
export const MAX_TRIAL_LABEL_LENGTH = 120;
export const MAX_TRIAL_DAYS = 7;
export const MAX_NOTIFICATION_TITLE_LENGTH = 160;
export const MAX_NOTIFICATION_BODY_LENGTH = 4000;
export const MAX_DONATION_TIER_LABEL_LENGTH = 120;
export const MAX_DONATION_TIER_DESCRIPTION_LENGTH = 500;
export const notificationAudiences = ["all", "authenticated", "admins"] as const;
export const notificationPriorities = ["info", "success", "warning", "critical"] as const;
export const feedbackStatuses = ["open", "reviewing", "closed"] as const;
export const supportContactChannelIds = ["telegram", "discord", "qq", "email", "wechat"] as const;
```

Export the existing helper functions with their existing behavior and error messages:

```ts
getSafeLocale
getRequiredString
getUserIds
getPositiveInteger
getPositiveDollarAmountInCents
getDiscountPercent
getTrialDays
getOptionalDateIso
getRequiredReason
getBoundedString
getManualReference
getReleaseDate
getReleaseNotes
getUploadFile
sanitizeFileName
getReleaseDeliveryMode
getOptionalReleaseUrl
getRequiredReleaseUrl
getSupportContactChannelId
validateSupportContactValue
```

- [ ] **Step 3: Import helpers from `actions.ts`**

Replace the local helper definitions in `src/app/[locale]/admin/actions.ts` with imports from `./actions/validation`.

- [ ] **Step 4: Verify focused tests**

Run:

```bash
npm test -- tests/unit/admin-actions.test.ts tests/unit/admin-license-actions.test.ts tests/unit/admin-contribution-pricing-page.test.tsx
```

Expected: all selected tests pass.

## Task 3: Extract Admin Audit Helper

**Files:**
- Create: `src/app/[locale]/admin/actions/audit.ts`
- Modify: `src/app/[locale]/admin/actions.ts`
- Test: `tests/unit/admin-actions.test.ts`
- Test: `tests/unit/admin-support-settings-page.test.tsx`

- [ ] **Step 1: Write a failing audit helper test**

Add a test that calls `insertAdminAuditLog` through a mocked Supabase admin client and asserts it inserts `action`, `admin_user_id`, `after`, `before`, `reason`, `target_id`, and `target_type`. Also assert it throws `"Unable to write audit log"` when Supabase returns an error.

Run:

```bash
npm test -- tests/unit/admin-actions.test.ts
```

Expected: fails because `insertAdminAuditLog` is not available from the new module.

- [ ] **Step 2: Create `audit.ts`**

Move `insertAdminAuditLog` into `src/app/[locale]/admin/actions/audit.ts` and export it.

- [ ] **Step 3: Import audit helper from action modules**

Update `src/app/[locale]/admin/actions.ts` to import `insertAdminAuditLog` from `./actions/audit`.

- [ ] **Step 4: Verify focused tests**

Run:

```bash
npm test -- tests/unit/admin-actions.test.ts tests/unit/admin-support-settings-page.test.tsx
```

Expected: selected tests pass.

## Task 4: Split Admin Actions by Domain Behind a Compatibility Barrel

**Files:**
- Create: `src/app/[locale]/admin/actions/donations.ts`
- Create: `src/app/[locale]/admin/actions/notifications.ts`
- Create: `src/app/[locale]/admin/actions/pricing.ts`
- Create: `src/app/[locale]/admin/actions/support.ts`
- Create: `src/app/[locale]/admin/actions/releases.ts`
- Create: `src/app/[locale]/admin/actions/licenses.ts`
- Create: `src/app/[locale]/admin/actions/users.ts`
- Modify: `src/app/[locale]/admin/actions.ts`
- Test: `tests/unit/admin-actions.test.ts`
- Test: `tests/unit/admin-license-actions.test.ts`
- Test: `tests/unit/admin-contribution-pricing-page.test.tsx`
- Test: `tests/unit/admin-support-settings-page.test.tsx`

- [ ] **Step 1: Move donation and certificate actions**

Move these exports into `donations.ts`:

```ts
addManualDonation
revokeCertificate
```

Keep their function names, form field names, redirects, `revalidatePath` calls, and error messages unchanged.

- [ ] **Step 2: Move notification actions**

Move these exports into `notifications.ts`:

```ts
createNotification
publishNotification
unpublishNotification
```

Keep all validation and redirect behavior unchanged.

- [ ] **Step 3: Move pricing actions**

Move this export into `pricing.ts`:

```ts
updateDonationTier
```

Keep contribution tier validation and redirect behavior unchanged.

- [ ] **Step 4: Move support actions**

Move these exports into `support.ts`:

```ts
updateSupportContactChannel
updateSupportFeedbackStatus
replySupportFeedbackAsAdmin
```

Keep support feedback status values and audit logging unchanged.

- [ ] **Step 5: Move release actions**

Move these exports into `releases.ts`:

```ts
createSoftwareRelease
setSoftwareReleasePublished
```

Keep storage bucket usage, file/link delivery behavior, backup URL validation, and revalidation unchanged.

- [ ] **Step 6: Move license actions**

Move these exports into `licenses.ts`:

```ts
createTrialCode
generateLicenseCodeBatch
revealLicenseCode
bulkDeleteLicenseCodes
bulkAdjustLicenseDuration
setTrialCodeActive
deleteTrialCode
updateTrialCode
```

Keep intentionally disabled bulk action messages unchanged.

- [ ] **Step 7: Move user/device/admin role actions**

Move these exports into `users.ts`:

```ts
updateAdminUserProfile
revokeDesktopSession
revokeCloudSyncLease
updateUserAccountStatus
softDeleteUser
bulkProcessUsers
permanentlyDeleteUser
updateUserAdminRole
unbindTrialMachine
```

Keep owner/operator checks, confirmation text, audit behavior, and redirect feedback unchanged.

- [ ] **Step 8: Replace `actions.ts` with compatibility re-exports**

Keep `src/app/[locale]/admin/actions.ts` as:

```ts
"use server";

export * from "./actions/donations";
export * from "./actions/notifications";
export * from "./actions/pricing";
export * from "./actions/support";
export * from "./actions/releases";
export * from "./actions/licenses";
export * from "./actions/users";
```

- [ ] **Step 9: Verify admin action regression tests**

Run:

```bash
npm test -- tests/unit/admin-actions.test.ts tests/unit/admin-license-actions.test.ts tests/unit/admin-contribution-pricing-page.test.tsx tests/unit/admin-support-settings-page.test.tsx tests/unit/admin-pages.test.tsx
```

Expected: selected tests pass.

## Task 5: Add Locale and Page Guard Utilities

**Files:**
- Create: `src/lib/i18n/page-locale.ts`
- Create: `src/lib/auth/page-guards.ts`
- Modify: selected pages only after tests exist.
- Test: `tests/unit/page-locale.test.ts`
- Test: `tests/unit/page-guards.test.ts`

- [ ] **Step 1: Write locale helper tests**

Create `tests/unit/page-locale.test.ts` covering:

```ts
expect(() => resolvePageLocale("en")).not.toThrow();
expect(() => resolvePageLocale("zh-Hant")).not.toThrow();
expect(() => resolvePageLocale("bad")).toThrow("NEXT_NOT_FOUND");
```

Mock `next/navigation` `notFound` to throw `"NEXT_NOT_FOUND"`, and mock `next-intl/server` `setRequestLocale`.

- [ ] **Step 2: Implement `page-locale.ts`**

Create:

```ts
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";

export function resolvePageLocale(locale: string): Locale {
  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  return locale as Locale;
}
```

- [ ] **Step 3: Write page guard tests**

Create `tests/unit/page-guards.test.ts` covering `setupAdminPage(locale, path)` and `setupUserPage(locale, path)`, mocking `requireAdmin`, `requireUser`, and `resolvePageLocale`.

- [ ] **Step 4: Implement `page-guards.ts`**

Create:

```ts
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { resolvePageLocale } from "@/lib/i18n/page-locale";

export async function setupAdminPage(locale: string, path: string) {
  const safeLocale = resolvePageLocale(locale);
  const user = await requireAdmin(safeLocale, path);
  return { locale: safeLocale, user };
}

export async function setupUserPage(locale: string, path: string) {
  const safeLocale = resolvePageLocale(locale);
  const user = await requireUser(safeLocale, path);
  return { locale: safeLocale, user };
}
```

- [ ] **Step 5: Adopt helper in low-risk pages first**

Start with pages that have simple setup and strong tests:

```txt
src/app/[locale]/versions/page.tsx
src/app/[locale]/notifications/page.tsx
src/app/[locale]/admin/notifications/page.tsx
src/app/[locale]/admin/audit-logs/page.tsx
```

Keep JSX output unchanged.

- [ ] **Step 6: Verify page tests**

Run:

```bash
npm test -- tests/unit/page-locale.test.ts tests/unit/page-guards.test.ts tests/unit/release-download-pages.test.tsx tests/unit/admin-pages.test.tsx
```

Expected: selected tests pass.

## Task 6: Add API Response Helpers

**Files:**
- Create: `src/lib/api/responses.ts`
- Modify: one low-risk route first, then expand only after tests.
- Test: `tests/unit/api-responses.test.ts`
- Test: existing API route tests.

- [ ] **Step 1: Write response helper tests**

Create `tests/unit/api-responses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "@/lib/api/responses";

describe("api responses", () => {
  it("returns a stable error payload and status", async () => {
    const response = jsonError("Unauthorized", 401);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns a stable success payload", async () => {
    const response = jsonOk({ ok: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Implement `responses.ts`**

Create:

```ts
import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}
```

- [ ] **Step 3: Adopt helper in low-risk API route**

Start with a route that already has stable tests, such as:

```txt
src/app/api/license/status/route.ts
```

Replace duplicated `NextResponse.json({ error: "..." }, { status })` calls with `jsonError`. Keep status codes and payloads identical.

- [ ] **Step 4: Verify API route tests**

Run:

```bash
npm test -- tests/unit/api-responses.test.ts tests/unit/license-status.test.ts tests/unit/desktop-entitlement-routes.test.ts tests/unit/desktop-auth-routes.test.ts
```

Expected: selected tests pass.

## Task 7: Frontend Hygiene Without Visual Drift

**Files:**
- Modify only pages/components with existing tests and stable accessible output.
- Candidate: `src/app/[locale]/page.tsx`
- Candidate: `src/components/site-footer.tsx`
- Candidate: `src/components/admin/admin-shell.tsx`
- Test: existing page/component tests.

- [ ] **Step 1: Add or tighten behavior tests before extraction**

For public/home components, ensure tests assert link destinations and headings, not class snapshots.

Run:

```bash
npm test -- tests/unit/release-download-pages.test.tsx tests/unit/site-footer.test.tsx tests/unit/admin-shell.test.tsx
```

Expected: tests pass before refactor.

- [ ] **Step 2: Extract only stable repeated constants**

Move repeated class strings or data arrays inside the same file or a nearby module only when it reduces duplication without hiding behavior. Do not change Tailwind values.

- [ ] **Step 3: Verify no visual contract changes through accessible output**

Run:

```bash
npm test -- tests/unit/release-download-pages.test.tsx tests/unit/site-footer.test.tsx tests/unit/site-header.test.tsx tests/unit/admin-shell.test.tsx
```

Expected: selected tests pass.

## Task 8: Final Full Verification

**Files:**
- No production edits in this task.

- [ ] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Run full unit suite**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js build exits 0.

- [ ] **Step 4: Review diff scope**

Run:

```bash
git diff --stat
git status --short
```

Expected: industrial hardening files are identifiable; unrelated existing dirty files are not reverted.

- [ ] **Step 5: Start dev server for manual visual check**

Run:

```bash
npm run dev
```

Expected: local server starts, usually at `http://localhost:3000`. Manually inspect `/en`, `/en/contributions`, `/en/support`, `/en/dashboard`, and `/en/admin` if credentials are available.

## Self-Review Notes

- Spec coverage: all phases from the design are represented: guardrails, admin action modularization, page setup helpers, frontend hygiene, API responses, and full verification.
- Placeholder scan: no TBD/TODO placeholders are required to execute the plan.
- Type consistency: helper names and module paths are defined before later tasks depend on them.
- Scope check: this plan preserves UI and behavior and avoids schema/payment changes.
