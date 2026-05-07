# API Response Completion Design

## Goal

Complete API response helper migration for tested routes while preserving every response body shape, status code, and redirect.

## Scope

Migrate tested remaining direct JSON responses in:

- Dodo webhook
- Desktop authorize
- Desktop auth exchange
- Desktop auth refresh
- Desktop auth logout
- Desktop entitlement

Do not change webhook validation, desktop session semantics, entitlement mapping, or redirect behavior.

## Design

Use `jsonError` for flat `{ error: string }` responses. Add `jsonPayload` for arbitrary response shapes such as nested desktop errors and entitlement payloads. Keep `NextResponse.redirect` where redirects are required.

## Testing

Focused tests:

- `tests/unit/dodo-webhook.test.ts`
- `tests/unit/desktop-auth-routes.test.ts`
- `tests/unit/desktop-refresh-logout-routes.test.ts`
- `tests/unit/desktop-entitlement-routes.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
