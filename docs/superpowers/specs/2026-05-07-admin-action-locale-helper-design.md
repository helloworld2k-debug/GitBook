# Admin Action Locale Helper Design

## Goal

Make admin server actions share the same action locale normalization helper used by user-facing actions.

## Scope

Update only `src/app/[locale]/admin/actions/validation.ts`. Do not change admin action modules, validation limits, redirects, or authorization.

## Design

Keep the existing exported `getSafeLocale` API for admin action modules and tests, but delegate its implementation to `getActionLocale`.

## Testing

Focused tests:

- `tests/unit/admin-actions.test.ts`
- `tests/unit/admin-license-actions.test.ts`
- `tests/unit/action-locale.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
