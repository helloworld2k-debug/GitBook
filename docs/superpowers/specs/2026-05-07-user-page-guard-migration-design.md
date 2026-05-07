# User Page Guard Migration Design

## Goal

Continue the stability-first cleanup by moving tested authenticated user pages to `setupUserPage`, preserving all UI, content, data queries, redirects, and authorization behavior.

## Scope

Migrate the user-facing authenticated page entries with direct test coverage:

- `/[locale]/dashboard`
- `/[locale]/dashboard/certificates/[id]`
- `/[locale]/dashboard/certificates/latest`
- `/[locale]/support/feedback/[id]`

Do not change dashboard actions, support actions, certificate download routes, public pages, or visual layout in this round.

## Design

Each page replaces local locale validation, request locale setup, and `requireUser` calls with `setupUserPage(localeParam, path)`. Pages keep their existing `notFound` imports only where they still need entity-level 404 behavior.

The dashboard test suite includes a focused assertion that the page calls `setupUserPage("en", "/en/dashboard")`, which proves the entrypoint migration is wired through the shared helper.

## Testing

Focused tests:

- `tests/unit/dashboard-page.test.tsx`
- `tests/unit/certificate-detail-page.test.tsx`
- `tests/unit/latest-certificate-redirect.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
