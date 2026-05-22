# GitBook AI Website

GitBook AI is a Next.js website for public software downloads supported by voluntary contributions. Visitors can download releases for free, view localized support tiers, and use protected contribution/dashboard surfaces through Supabase Auth. Admin users can review persisted contribution records and certificates.

The project is still an implementation baseline. Treat Dodo Payments configuration, Auth provider configuration, production domains, and operational runbooks as deployment tasks, not finished production guarantees.

## Architecture

- **App framework:** Next.js App Router with React 19 and TypeScript.
- **Internationalization:** `next-intl` with English, Traditional Chinese, Japanese, and Korean locale routes.
- **Data and Auth:** Supabase Auth and Postgres with row-level security.
- **Payments:** Dodo Payments checkout with webhook persistence for contribution records, certificate issuance, and entitlement updates.
- **Certificates:** Server-side certificate generation backed by Supabase functions and tables, with protected SVG downloads. Native PNG/PDF export is a later enhancement.
- **Hosting target:** Vercel for the app and API routes.

Key directories:

- `src/app` - localized pages and API routes.
- `src/components` - shared UI components.
- `src/config/site.ts` - public site copy, download links, support tiers, and sponsor levels.
- `src/lib` - Supabase clients, auth guards, payment helpers, contribution records, and certificates.
- `supabase/migrations` - database schema, seed data, RLS policies, and certificate functions.
- `tests` - unit, smoke, and Playwright e2e tests.

## Local Setup

### Quick Start (Recommended)

```bash
# Install dependencies
npm install

# Setup environment (interactive - creates .env.local from template)
npm run setup

# Run development server (auto-checks env before starting)
npm run dev
```

The `npm run setup` command will:
- Check if `.env.local` exists
- Create it from `.env.example` if missing
- Prompt you to fill in required values
- Open the file in your editor for configuration

### Manual Setup

If you prefer manual setup:

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Required Environment Variables

Fill in Supabase and Dodo Payments values in `.env.local`:

```bash
# Local development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Dodo Payments (use test credentials for development)
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=
DODO_PAYMENTS_ENV=test
DODO_PRODUCT_MONTHLY=
DODO_PRODUCT_QUARTERLY=
DODO_PRODUCT_YEARLY=
```

**For production deployment:**
- Set `NEXT_PUBLIC_SITE_URL` to your production domain
- Set `DODO_PAYMENTS_ENV=live` with production credentials
- Update product IDs to match your live Dodo products

### Environment Check

The project automatically checks environment configuration:
- `npm run dev` runs `predev` check before starting
- `npm run check-env` manually verifies your setup
- Missing or incomplete `.env.local` will block dev server with helpful messages

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The root route redirects to `/en`.

## Database

Apply Supabase migrations in order before testing authenticated, contribution, certificate, or admin flows:

```bash
supabase db push
```

Without the Supabase CLI, run the SQL files manually in this order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_certificate_functions.sql`
3. `supabase/migrations/0003_public_sponsors.sql`
4. `supabase/migrations/0004_public_display_name_limit.sql`
5. `supabase/migrations/0005_admin_audit_rpcs.sql`

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

See [docs/deployment.md](docs/deployment.md) for the practical Vercel deployment flow, including Supabase setup, Dodo Payments webhooks, admin bootstrap, DNS, security notes, and the production checklist.

Current deployment caveats:

- Supabase Auth providers and allowed callback URLs must be configured for the interactive login flow before production use.
- Dodo Payments checkout sessions are persisted and generate certificates through the Dodo webhook.
- Dodo Payments is the only supported production checkout path in this repository.

## Security Notes

- Do not commit `.env.local` or real secrets.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `DODO_PAYMENTS_API_KEY`, and `DODO_PAYMENTS_WEBHOOK_KEY` server-only.
- Only `NEXT_PUBLIC_*` values should be used in browser code.
- Keep Supabase RLS enabled and review policies before adding new tables or admin actions.
- Use sandbox/test payment credentials outside production.
- Verify the Dodo Payments flow writes a paid contribution record and certificate before enabling production checkout.
- Rotate provider and database secrets after exposure or access changes.
