# Public Page Locale Completion Design

## Goal

Complete low-risk public page locale helper adoption while preserving redirects, callbacks, and homepage rendering.

## Scope

Migrate:

- `/[locale]/login`
- `/[locale]`
- `/[locale]/donate`

Do not change auth callback sanitization, homepage release loading, or redirect destinations.

## Design

Use `resolvePageLocale` for pages that should 404 unsupported locales and call `setRequestLocale`. Use `getActionLocale` for the legacy `/donate` redirect because it intentionally falls back unsupported locale values to English.

## Testing

Focused tests:

- `tests/unit/release-download-pages.test.tsx`
- `tests/unit/login-page.test.tsx`
- `tests/unit/donate-redirect.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
