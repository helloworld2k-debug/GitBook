# Admin Edge Page Guard Migration Design

## Goal

Finish the remaining admin page guard migration by moving release management and support feedback detail pages to `setupAdminPage`.

## Scope

Migrate:

- `/[locale]/admin/releases`
- `/[locale]/admin/support-feedback/[id]`

Do not change release upload behavior, release publication logic, support reply behavior, data queries, or layout.

## Design

Both pages will call `setupAdminPage(localeParam, path)` at the top of the server component. The support feedback detail page keeps its existing `notFound` handling for missing feedback records.

## Testing

Run focused admin tests where available, then full project verification:

- `npm test -- tests/unit/admin-pages.test.tsx tests/unit/admin-actions.test.ts`
- `npm run lint`
- `npm test`
- `npm run build`
