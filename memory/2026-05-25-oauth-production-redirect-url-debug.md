# OAuth Production Redirect URL Debug

Date: 2026-05-25
Branch: `fix/oauth-production-redirect-url`

## Symptom

Google and GitHub OAuth can open the provider login page, but after provider authentication Supabase redirects back to a local `127.0.0.1` URL instead of `https://gitbookai.ccwu.cc`.

## Root Cause

The deployed Next.js login page already renders OAuth `redirectTo` as `https://gitbookai.ccwu.cc/auth/callback?...`, confirmed from the production HTML and `/api/debug/webhook-status`.

The remaining redirect to `127.0.0.1` comes from Supabase Auth configuration drift: `supabase/config.toml` still had:

- `site_url = "http://127.0.0.1:3000"`
- `additional_redirect_urls` only for local URLs

When the OAuth provider returns to Supabase and the requested callback is not allowed, Supabase falls back to its configured Site URL. Because that Site URL was local, users landed on `127.0.0.1`.

## Fix

- Set Supabase Auth `site_url` to `https://gitbookai.ccwu.cc`.
- Add allowed OAuth redirects for:
  - `https://gitbookai.ccwu.cc/**`
  - `https://*.vercel.app/**`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`
- Updated `scripts/check-config.sh` so future checks fail if hosted OAuth config would send users back to local URLs.
- Added a regression assertion in `tests/unit/supabase-migrations.test.ts`.

## Evidence

- Production login HTML contains `https://gitbookai.ccwu.cc/auth/callback?...`, not a local callback.
- `/api/debug/webhook-status` reports `NEXT_PUBLIC_SITE_URL=https://gitbookai.ccwu.cc`.
- Red test observed before fix: expected production `site_url`, got `http://127.0.0.1:3000`.
- `npm run check-config`: passed.
- `npm test -- tests/unit/supabase-migrations.test.ts tests/unit/login-page.test.tsx tests/unit/desktop-login-page.test.tsx tests/unit/login-form.test.tsx tests/unit/auth-redirect.test.ts`: 57 passed.
- `npm run lint`: passed.

## Follow-Up Required

This repository change does not update hosted Supabase by itself. Apply the Auth config to the remote Supabase project with:

```bash
supabase config push --yes
```

Then verify in Supabase Dashboard that Auth Site URL is `https://gitbookai.ccwu.cc` and Redirect URLs include the production domain.

## Status

DONE_WITH_CONCERNS
