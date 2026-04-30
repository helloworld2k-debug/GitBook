# Three Friends Website

Three Friends is a Next.js website for public software downloads supported by voluntary donations. Visitors can download releases for free, view localized donation tiers, and use protected donation/dashboard surfaces through Supabase Auth. Admin users can review persisted donations and certificates.

The project is still an implementation baseline. Treat PayPal donation persistence, payment credentials, Auth provider configuration, production domains, and operational runbooks as deployment tasks, not finished production guarantees.

## Architecture

- **App framework:** Next.js App Router with React 19 and TypeScript.
- **Internationalization:** `next-intl` with English, Traditional Chinese, Japanese, and Korean locale routes.
- **Data and Auth:** Supabase Auth and Postgres with row-level security.
- **Payments:** Stripe Checkout with webhook persistence; PayPal Checkout/webhook scaffolding is present, but PayPal donation persistence and certificate issuance still need to be completed before production use.
- **Certificates:** Server-side certificate generation backed by Supabase functions and tables.
- **Hosting target:** Vercel for the app and API routes.

Key directories:

- `src/app` - localized pages and API routes.
- `src/components` - shared UI components.
- `src/config/site.ts` - public site copy, download links, donation tiers, and sponsor levels.
- `src/lib` - Supabase clients, auth guards, payment helpers, donation records, and certificates.
- `supabase/migrations` - database schema, seed data, RLS policies, and certificate functions.
- `tests` - unit, smoke, and Playwright e2e tests.

## Local Setup

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in Supabase, Stripe, and PayPal values. The minimum local template is:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The root route redirects to `/en`.

## Database

Apply Supabase migrations in order before testing authenticated, donation, certificate, or admin flows:

```bash
supabase db push
```

Without the Supabase CLI, run the SQL files manually in this order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_certificate_functions.sql`
3. `supabase/migrations/0003_public_sponsors.sql`
4. `supabase/migrations/0004_public_display_name_limit.sql`

After an admin user exists in Supabase Auth, bootstrap admin access in Supabase:

```sql
update public.profiles
set is_admin = true
where email = 'admin@example.com';
```

## Scripts and Checks

```bash
npm run dev
npm run lint
npm test
npm run build
npm run e2e
```

`npm run e2e` starts the app through Playwright's configured web server. It is useful after page or routing changes; for docs-only changes it may be skipped if local time is tight.

## Deployment

See [docs/deployment.md](docs/deployment.md) for the practical Vercel deployment flow, including Supabase setup, payment provider webhooks, admin bootstrap, DNS, security notes, and the production checklist.

Current deployment caveats:

- Supabase Auth providers and allowed callback URLs must be configured for the interactive login flow before production use.
- Stripe paid checkout sessions are persisted and generate certificates through the Stripe webhook.
- PayPal routes can create/capture/verify orders, but PayPal payments are not yet persisted to the `donations` table and do not yet generate certificates.

## Security Notes

- Do not commit `.env.local` or real secrets.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` server-only.
- Only `NEXT_PUBLIC_*` values should be used in browser code.
- Keep Supabase RLS enabled and review policies before adding new tables or admin actions.
- Use sandbox/test payment credentials outside production.
- Verify each payment provider writes a paid donation and certificate before enabling that provider for real users.
- Rotate provider and database secrets after exposure or access changes.
