# Page Guard and API Response Unification Design

Date: 2026-05-07

## Summary

Continue industrial hardening by applying the page locale/auth helpers and API response helpers introduced in the previous round. This round keeps every visual layout, localized copy, route, redirect, status code, and response payload unchanged.

## Scope

- Migrate low-risk public pages to `resolvePageLocale`.
- Migrate low-risk admin/user pages to `setupAdminPage` or `setupUserPage`.
- Migrate API routes with existing unit coverage from direct `NextResponse.json` calls to `jsonOk` or `jsonError`.
- Add focused regression tests where helper adoption could otherwise hide behavior changes.

## Non-Goals

- No UI redesign.
- No route or payload changes.
- No database schema changes.
- No new product features.
- No broad page component rewrites.

## Candidate Pages

Start with pages that already follow the simple pattern `params.locale` → locale validation → request locale setup:

- `src/app/[locale]/versions/page.tsx`
- `src/app/[locale]/contributions/page.tsx`
- `src/app/[locale]/support/page.tsx`
- `src/app/[locale]/reset-password/page.tsx`
- `src/app/[locale]/admin/donations/page.tsx`
- `src/app/[locale]/admin/certificates/page.tsx`
- `src/app/[locale]/admin/contribution-pricing/page.tsx`

Avoid high-risk certificate detail/download and user-detail pages in this round unless existing tests make the migration straightforward.

## Candidate API Routes

Start with routes that already have unit tests and simple JSON response shapes:

- `src/app/api/auth/register/route.ts`
- `src/app/api/checkout/dodo/route.ts`
- `src/app/api/license/cloud-sync/activate/route.ts`
- `src/app/api/license/cloud-sync/heartbeat/route.ts`
- `src/app/api/license/cloud-sync/release/route.ts`

Keep response bodies and HTTP status codes identical.

## Acceptance Criteria

- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Migrated pages keep the same accessible headings, links, forms, and redirects.
- Migrated API routes return identical JSON bodies and status codes.
