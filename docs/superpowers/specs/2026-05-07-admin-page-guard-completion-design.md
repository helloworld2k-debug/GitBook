# Admin Page Guard Completion Design

## Goal

Continue the stability-first optimization by migrating the remaining tested admin page entries to the shared `setupAdminPage` helper. Preserve all UI, content, database queries, actions, redirects, and authorization behavior.

## Scope

Migrate only admin page components that already have direct unit test coverage:

- `/[locale]/admin`
- `/[locale]/admin/licenses`
- `/[locale]/admin/support-feedback`
- `/[locale]/admin/support-settings`
- `/[locale]/admin/users`
- `/[locale]/admin/users/[id]`

Do not change server actions, public pages, dashboard pages, download routes, release page behavior, or visual layout in this round.

## Design

Each target page will replace its local `supportedLocales` check, `notFound`, `setRequestLocale`, and `requireAdmin` sequence with `setupAdminPage(localeParam, path)`.

For pages that need the admin user object, destructure it as `user: admin` to preserve local variable usage. Existing calls to `getAdminShellProps` will receive the typed locale returned by `setupAdminPage`, removing casts without changing runtime behavior.

## Testing

Run the focused admin page tests after migration:

- `tests/unit/admin-pages.test.tsx`
- `tests/unit/admin-support-settings-page.test.tsx`

Then run full verification before committing:

- `npm run lint`
- `npm test`
- `npm run build`
