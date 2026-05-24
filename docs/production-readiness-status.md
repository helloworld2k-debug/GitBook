# Production Readiness Status

Last checked: 2026-05-24 12:52 UTC

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
- Production Dodo debug status reports `NEXT_PUBLIC_SITE_URL=https://gitbookai.ccwu.cc`, `DODO_PAYMENTS_ENV=live`, and Dodo API/webhook/product variables set.
- Supabase linked query succeeds against the production project.
- Local Supabase config keeps email confirmations disabled.
- Supabase session refresh is implemented through `src/proxy.ts` and `src/lib/supabase/middleware.ts`.
- Production login page returns `200`, login API rejects missing-origin requests with `403`, and invalid credentials with a valid production origin return `401`.
- Production profiles include existing admin/operator users.
- Anonymous checkout POST with a valid origin redirects to `/en/login?next=%2Fen%2Fcontributions`.
- Production contributions page displays the live `1-Day Dev Support` option and the Traditional Chinese `1 天開發支持` option.
- Production CSP `form-action` allows Dodo's actual live checkout redirect host `https://checkout.dodopayments.com`.
- Supabase production migrations are applied through `0061_one_day_live_payment_test.sql`.

## Open Items

- Configure or intentionally redirect `www.gitbookai.ccwu.cc`; it is currently unreachable from the canary. DNS already resolves through `cname.vercel-dns-0.com`, but `vercel domains add www.gitbookai.ccwu.cc` returned `domain_not_owned`, so ownership must be verified or added in the Vercel Domains dashboard.
- Verify Supabase Auth provider settings and redirect allowlist in the Supabase Dashboard.
- Run an interactive production email login through a real account.
- Run a real 1-day live checkout and confirm webhook-created donation, certificate, and 1-day cloud-sync entitlement records.
- Document owners for Dodo, Supabase, Vercel, DNS, and secret rotation.

## Live Payment Cutover

Live mode is enabled in Vercel production as of 2026-05-24.

1. Create live Dodo products for the 1-day, monthly, quarterly, and yearly support tiers.
2. Configure the live webhook endpoint as `https://gitbookai.ccwu.cc/api/webhooks/dodo`.
3. Set Vercel production variables: `DODO_PAYMENTS_ENV=live`, `DODO_PAYMENTS_API_KEY`, and `DODO_PAYMENTS_WEBHOOK_KEY`. Do not leave `DODO_PAYMENTS_ENV` empty; empty values use test mode.
4. Save the 1-day, monthly, quarterly, and yearly live product IDs in Admin > Support pricing > Dodo payment product IDs. Use `DODO_LIVE_PRODUCT_ONE_DAY`, `DODO_LIVE_PRODUCT_MONTHLY`, `DODO_LIVE_PRODUCT_QUARTERLY`, and `DODO_LIVE_PRODUCT_YEARLY` only as fallback values if the admin table is not populated yet.
5. Redeploy production and run `npm run canary:production`.
6. Run one live low-value checkout and confirm donation, certificate, and entitlement records.

## 2026-05-24 Live Payment Change Log

- Added a public temporary `one_day` contribution tier for a 1-day, USD 1.00 live checkout smoke test.
- Seeded the Dodo live `one_day` product ID in Supabase and Vercel fallback variables.
- Added `DODO_PAYMENTS_ENV=live`, Dodo live API key, webhook signing key, and live product fallback variables to Vercel production. Secrets are stored only in Vercel environment variables.
- Applied Supabase migrations `0056` through `0061` to production, including payment product settings, payment maintenance settings, the `one_day` tier, and the 1-day cloud-sync entitlement RPC.
- Verified Dodo live API can create a checkout session for the 1-day product and returns `checkout_url`.
- Fixed checkout navigation by allowing `https://checkout.dodopayments.com` in the production CSP `form-action`; Dodo live uses this host for the final checkout redirect.
- Verified Vercel production deployment is ready and `https://gitbookai.ccwu.cc/zh-Hant/contributions` includes `1 天開發支持`.
- Verification commands during the change: `npm run lint`, `npx tsc --noEmit`, and `npm test -- --run`.

## Ownership Register

Fill these before production announcement:

| Area | Owner | Backup | Rotation / Review cadence |
| --- | --- | --- | --- |
| Dodo Payments | TBD | TBD | TBD |
| Supabase project and database | TBD | TBD | TBD |
| Vercel project and deployments | TBD | TBD | TBD |
| DNS / domain registrar | TBD | TBD | TBD |
| Production secrets and rotation | TBD | TBD | TBD |
