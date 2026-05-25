# OAuth Google/GitHub Auth Debug

Date: 2026-05-25
Branch: `fix/oauth-google-github-auth`
Worktree: `.worktrees/fix-oauth-google-github-auth`

## Symptom

Users reported that Google and GitHub registration/login could not complete.

## Root Cause

The Supabase `auth.users` insert trigger `public.handle_new_user_profile()` copied OAuth provider profile names directly into `public.profiles.public_display_name`. A later schema constraint limits `public_display_name` to 80 characters, but OAuth metadata from Google/GitHub can exceed that limit. When that happens, the trigger raises a constraint error during user creation, so the OAuth callback cannot finish creating/signing in the user.

Local Supabase redirect configuration also allowed only `https://127.0.0.1:3000`, while the app and docs use `http://localhost:3000/auth/callback`. That mismatch prevents local OAuth provider callbacks from being accepted.

## Fix

- Added `supabase/migrations/0064_oauth_profile_display_name_limit.sql`.
- Replaced `public.handle_new_user_profile()` with a version that trims blank OAuth metadata and caps:
  - `display_name` at 120 characters.
  - `public_display_name` at 80 characters.
- Sets `email_verified` at profile creation when Supabase Auth already confirmed the email.
- Uses `on conflict (id) do update` so reruns are safe.
- Updated `supabase/config.toml` local redirect allow-list to cover `http://localhost:3000/**` and `http://127.0.0.1:3000/**`.
- Added a regression assertion in `tests/unit/supabase-migrations.test.ts`.

## Evidence

- Red test observed before fix: missing `0064_oauth_profile_display_name_limit.sql`.
- `npm test -- tests/unit/supabase-migrations.test.ts`: 13 passed.
- `npm test -- tests/unit/login-form.test.tsx tests/unit/login-page.test.tsx tests/unit/auth-redirect.test.ts tests/unit/desktop-login-form.test.tsx tests/unit/desktop-login-page.test.tsx`: 46 passed.
- `npm test`: 122 files passed, 652 tests passed.
- `npm run lint`: passed with no output.
- Production login page reached with HTTP 200 at `https://gitbookai.ccwu.cc/en/login`.

## Verification Limits

The new worktree does not have configured Supabase credentials in `.env.local`, so I did not perform an end-to-end live OAuth authorization with Google or GitHub from the local app. The database migration needs to be applied to the target Supabase project, and provider redirect allow-lists in Supabase Dashboard must include the production domain.

## Status

DONE_WITH_CONCERNS
