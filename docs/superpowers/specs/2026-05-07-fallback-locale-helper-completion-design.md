# Fallback Locale Helper Completion Design

## Goal

Reuse the shared action-locale fallback helper in remaining non-page fallback paths.

## Scope

Migrate:

- Dodo checkout locale normalization
- Admin feedback return path locale normalization

Do not change page-level 404 locale validation, admin shell locale selection, auth guard locale extraction, or notification targeting validation.

## Design

Use `getActionLocale` where unsupported locale values intentionally fall back to English. Add direct tests for `sanitizeAdminReturnTo` to lock down safe admin path behavior before delegating its locale normalization.

## Testing

Focused tests:

- `tests/unit/dodo-checkout.test.ts`
- `tests/unit/admin-feedback.test.ts`
- `tests/unit/action-locale.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
