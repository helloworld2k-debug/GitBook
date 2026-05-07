# Certificate Download Guard Migration Design

## Goal

Move the protected certificate SVG download route to the shared user page guard while preserving export output and authorization redirects.

## Scope

Migrate only:

- `/[locale]/dashboard/certificates/[id]/download/[format]`

Do not add new export formats, change SVG rendering, alter headers, or change certificate ownership checks.

## Design

Validate the requested format before authentication so unsupported binary formats still return 404 without touching auth or Supabase. For supported SVG downloads, call `setupUserPage(localeParam, path)` and reuse the returned locale and user for translations, ownership filtering, and recipient display.

## Testing

Focused test:

- `tests/unit/certificate-export-route.test.ts`

Final verification:

- `npm run lint`
- `npm test`
- `npm run build`
