# Production Readiness Status

Last checked: 2026-05-22 17:37 UTC

## Automated Checks

- `npm run lint`: pass
- `npm test`: pass, 114 files and 579 tests
- `npm run build`: pass
- `npm run e2e`: pass, 20 tests
- `npm run check-config`: pass
- `npm run canary:production`: fail only on `www domain`

## Verified

- Apex DNS for `gitbookai.ccwu.cc` resolves to `216.198.79.1`.
- `https://gitbookai.ccwu.cc/en`, `/zh-Hant`, `/ja`, `/ko`, `/en/versions`, `/en/contributions`, `/en/support`, `/en/news`, and `/en/login` return `200`.
- `/auth/callback` without a code redirects to `/en/login?error=missing-code&next=%2Fen%2Fdashboard`.
- Public macOS and Windows download links return `200` with `application/zip`.
- Vercel production environment variables are present.
- Production Dodo debug status reports `NEXT_PUBLIC_SITE_URL=https://gitbookai.ccwu.cc`, `DODO_PAYMENTS_ENV=test`, and Dodo API/webhook/product variables set.
- Supabase linked query succeeds against the production project.
- Local Supabase config keeps email confirmations disabled.
- Supabase session refresh is implemented through `src/proxy.ts` and `src/lib/supabase/middleware.ts`.

## Open Items

- Configure or intentionally redirect `www.gitbookai.ccwu.cc`; it is currently unreachable from the canary.
- Verify Supabase Auth provider settings and redirect allowlist in the Supabase Dashboard.
- Run an interactive production email login through a real account.
- Bootstrap and confirm the first production admin user.
- Run a real Dodo test checkout and confirm webhook-created donation, certificate, and cloud-sync entitlement records.
- Decide when to switch `DODO_PAYMENTS_ENV` from `test` to `live`.
- Document owners for Dodo, Supabase, Vercel, DNS, and secret rotation.
