# Full Stack Industrial Hardening Design

Date: 2026-05-07

## Summary

Optimize the existing GitBook AI website toward an industrial-grade application while preserving all current appearance, content layout, localized copy, routes, and frontend/backend behavior. The work is stability-first and phased: establish guardrails, refactor internals behind existing contracts, and verify each phase with lint, unit tests, and production build.

## Non-Negotiable Constraints

- Do not redesign the UI.
- Do not change visible page layout, navigation structure, content hierarchy, or localized meaning.
- Do not remove or weaken existing frontend, backend, payment, license, certificate, support, notification, or admin behavior.
- Do not revert unrelated uncommitted work already present in the workspace.
- Keep every refactor behavior-preserving unless a test exposes an existing bug and the fix is explicitly scoped.

## Current Signals

- The app is a Next.js App Router project with TypeScript, Tailwind CSS, next-intl, Supabase, Dodo Payments, Vitest, and Playwright.
- The test suite is already broad: unit tests cover public pages, dashboard, admin flows, license/cloud sync, certificates, checkout, and API routes.
- `src/app/[locale]/admin/actions.ts` is the largest maintainability hotspot at roughly 1,700 lines.
- Several pages repeat locale validation, request locale setup, auth guards, Supabase setup, and page shell patterns.
- Some server routes and helpers use broad `catch` blocks that hide operational context.
- The working tree includes unrelated admin/pricing edits and recent navigation/footer edits. The optimization must work with these changes, not revert them.

## Phased Approach

### Phase 1: Guardrails and Baseline

Establish a clean verification baseline before structural changes:

- Run and record `npm run lint`, `npm test`, and `npm run build`.
- Identify files touched by the industrial hardening work versus pre-existing dirty files.
- Keep any new abstractions covered by focused tests before production code changes.
- Add tests only where they protect behavior affected by a refactor.

### Phase 2: Backend Action Modularization

Split `src/app/[locale]/admin/actions.ts` into domain modules while preserving public action names and form behavior.

Target module boundaries:

- `src/app/[locale]/admin/actions/validation.ts`: shared form parsing and validation helpers.
- `src/app/[locale]/admin/actions/audit.ts`: audit log helpers and admin metadata.
- `src/app/[locale]/admin/actions/releases.ts`: release creation and download delivery actions.
- `src/app/[locale]/admin/actions/support.ts`: support contact settings and feedback actions.
- `src/app/[locale]/admin/actions/notifications.ts`: notification creation and read-state admin actions.
- `src/app/[locale]/admin/actions/licenses.ts`: trial/license/admin entitlement actions.
- `src/app/[locale]/admin/actions/users.ts`: user status, role, deletion, and bulk user actions.
- `src/app/[locale]/admin/actions/pricing.ts`: contribution pricing actions.
- `src/app/[locale]/admin/actions.ts`: compatibility barrel that re-exports the existing action API.

This preserves existing imports during the first pass and allows pages/tests to migrate later only if useful.

### Phase 3: Page and Data-Loading Structure

Create small server-side utilities for repeated page setup patterns:

- Validate locale and call `setRequestLocale` through a shared helper.
- Provide admin/user page setup helpers that wrap locale validation and auth guard calls.
- Keep redirects and `notFound()` behavior identical.
- Avoid changing JSX structure where visual output could drift.

Candidate utilities:

- `src/lib/i18n/page-locale.ts`
- `src/lib/auth/page-guards.ts`

### Phase 4: Frontend Component Hygiene

Improve maintainability without altering rendered design:

- Extract repeated class strings only when they are truly shared and stable.
- Prefer existing components over new abstractions when the page structure is unique.
- Keep Tailwind class values semantically equivalent.
- Preserve accessible names and link destinations.
- Avoid component splits that make page behavior harder to trace.

Initial safe targets:

- Public page section/link card helpers.
- Admin shell navigation metadata and repeated empty/error panels.
- Form status and submit button composition where duplication is obvious.

### Phase 5: API and Error Boundary Hardening

Standardize route handler behavior while preserving response formats:

- Add helper functions for JSON error responses used by API routes.
- Replace broad empty catches with narrow fallbacks or safe logging boundaries where tests can assert behavior.
- Keep user-facing error messages stable.
- Keep payment, license, desktop auth, and webhook security behavior unchanged.

### Phase 6: Test and Verification Expansion

For each refactor phase:

- Run the relevant focused tests first.
- Run `npm run lint`.
- Run `npm test`.
- Run `npm run build`.
- Add tests for module seams introduced during refactors.
- For UI-sensitive changes, prefer assertions on accessible names, links, and unchanged behavior rather than snapshot churn.

## Acceptance Criteria

- All current routes continue to compile.
- All existing tests pass after each phase.
- `npm run lint`, `npm test`, and `npm run build` pass before completion.
- Public pages keep the same visual structure and localized content.
- Admin, support, contribution, license, certificate, notification, and desktop API flows keep their current behavior.
- The largest action file is decomposed into focused modules with clear ownership.
- Shared helpers reduce repeated locale/auth/data-loading code without introducing hidden side effects.

## Out of Scope

- Visual redesign.
- New product features.
- Payment provider changes.
- Database schema changes unless a refactor reveals an existing test-covered defect that requires one.
- Removing existing functionality.
- Reverting unrelated user or prior-agent edits.
