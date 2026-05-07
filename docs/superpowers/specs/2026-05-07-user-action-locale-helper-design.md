# User Action Locale Helper Design

## Goal

Reduce duplicated safe-locale handling in user-facing server actions while preserving redirects, authorization paths, and form behavior.

## Scope

Migrate:

- Dashboard account actions
- Support feedback actions
- Notification read action
- Reset password action

Do not change admin action behavior, form validation rules, Supabase writes, or UI.

## Design

Add `getActionLocale` in `src/lib/i18n/action-locale.ts`. It accepts string-like action inputs and returns the locale if supported, otherwise `"en"`.

Server actions call this helper before constructing redirect paths or authorization paths. This mirrors existing fallback behavior while removing page-local helper duplication.

## Testing

Focused tests:

- `tests/unit/action-locale.test.ts`
- `tests/unit/support-feedback-actions.test.ts`
- `tests/unit/dashboard-account-actions.test.ts`
- `tests/unit/reset-password-actions.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
