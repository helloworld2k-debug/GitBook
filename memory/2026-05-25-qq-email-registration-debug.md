# QQ email registration debug

Date: 2026-05-25

## Symptom

`38250116@qq.com` cannot register, while other `qq.com` emails can.

## Root cause hypothesis

The address itself passes the route email schema, so it is not rejected because of the `qq.com` domain or numeric local part. The registration route uses Supabase Admin `createUser`. When Supabase reports an already registered confirmed email, the route collapsed that duplicate-user condition into `register_failed`. The frontend already supports a clearer `account_exists` response, but the route did not return it for confirmed existing users.

Supabase CLI remote query confirmed that `38250116@qq.com` already exists in `auth.users`. It was created on 2026-05-05, confirmed on 2026-05-05, and last signed in on 2026-05-22. No active `registration_blocks` rows exist for either `38250116@qq.com` or `qq.com`.

The same CLI check found no matching `public.profiles` row for that auth user. That is separate from the duplicate-registration error message, but it may affect post-login profile/dashboard behavior and should be repaired deliberately.

Follow-up fix on 2026-05-25:

- Backfilled all 3 remote Auth users that were missing `public.profiles` rows.
- Rechecked `auth.users` without matching `profiles`: 0.
- Added a route-level guard so duplicate confirmed registration attempts repair a missing profile before returning `account_exists`.

## Fix

Return `account_exists` with HTTP 409 when Supabase Admin reports the email is already registered and the matching user is already confirmed. Keep the existing behavior for unconfirmed users: update/confirm that user and let the client sign in.

## Evidence

- `38250116@qq.com` passes the Zod email/password schema locally.
- Supabase CLI `db query --linked` confirms the email is an already-confirmed Auth user, not a blocked domain or invalid address.
- Registration route tests now cover confirmed duplicate emails and expect `account_exists`.
- Login form already handles `account_exists` by switching to sign-in and showing the existing-account message.
- Full Vitest suite passed: 122 files, 651 tests.
- `npx tsc --noEmit` passed.
