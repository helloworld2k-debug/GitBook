# Deployment

This guide covers a low-cost deployment path for the GitBook AI website. It assumes Vercel for the Next.js app, Supabase for Auth and Postgres, and Dodo Payments for hosted checkout and webhook processing.

The current codebase is a deployable baseline, not a finished production launch. Dodo Payments persistence and certificate generation are wired through the Dodo webhook. Supabase login UI and callback handling are implemented, but Auth providers and redirect allowlists still need deployment configuration.

## Services

- **Vercel:** hosts the Next.js application and API routes.
- **Supabase:** provides Postgres, row-level security, Auth, and server-side admin access.
- **Dodo Payments:** creates hosted checkout sessions and sends payment webhooks for contribution records and certificate issuance.
- **GitHub Releases or object storage:** hosts public software downloads. The current app points download links at release URLs in `src/config/site.ts`.

This stack keeps fixed costs low: Vercel and Supabase can start on their free or low-cost tiers, while Dodo Payments charges transaction fees. For domestic and overseas users, use a custom domain, keep the app globally hosted on Vercel, and verify the full Dodo checkout and webhook flow end to end before launch.

## Environment Variables

Copy `.env.example` to `.env.local` for local development and set the same names in Vercel project settings for preview and production deployments.

| Name | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical app URL. Use `http://localhost:3000` locally and `https://your-domain.com` in production. Checkout redirects use this value. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL. Safe for browser use. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon public key. Safe for browser use with RLS enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key for webhooks and certificate generation. Never expose it to client code. |
| `DODO_PAYMENTS_API_KEY` | Server only | Dodo Payments API key for creating checkout sessions. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Server only | Signing key for validating Dodo webhook events. |
| `DODO_PAYMENTS_ENV` | Server only | Use `test` locally and switch to the production value for live checkout. |
| `DODO_PRODUCT_MONTHLY` | Server only | Dodo product ID for the monthly support tier. |
| `DODO_PRODUCT_QUARTERLY` | Server only | Dodo product ID for the quarterly support tier. |
| `DODO_PRODUCT_YEARLY` | Server only | Dodo product ID for the yearly support tier. |

## Setup Order

1. Create the Supabase project.
2. Apply database migrations in order from `supabase/migrations`.
3. Configure Supabase Auth and allowed redirect URLs.
4. Create Dodo Payments test products and webhook configuration.
5. Create the Vercel project and add all environment variables.
6. Deploy to Vercel preview and run Dodo test checkout verification.
7. Bootstrap the first admin user in Supabase.
8. Attach the production domain and update callback and webhook allowlists.
9. Switch Dodo Payments from test credentials to live credentials.
10. Run the production checklist before announcing the site.

## Supabase

Create a Supabase project near the expected primary user base. If you expect a split between domestic and overseas visitors, choose the region with the best operational fit for the team and rely on Vercel edge routing plus lightweight pages for global delivery.

Apply migrations in numeric order:

```bash
supabase db push
```

If you are not using the Supabase CLI, open the SQL editor and run:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_certificate_functions.sql`
3. `supabase/migrations/0003_public_sponsors.sql`
4. `supabase/migrations/0004_public_display_name_limit.sql`
5. `supabase/migrations/0005_admin_audit_rpcs.sql`

The migrations create profiles, support tiers, sponsor levels, payment records, certificates, admin audit logs, row-level security policies, and certificate number functions.

Configure Auth:

- Enable the sign-in methods the handoff team wants to support: email/password, Google, and GitHub.
- Verify the interactive login UI and `/auth/callback` route against the deployed Supabase project before relying on contribution or admin flows through the browser.
- Add local and deployed URLs to Supabase Auth redirect allowlists:
  - `http://localhost:3000/**`
  - `https://your-vercel-preview-domain.vercel.app/**`
  - `https://your-domain.com/**`
- Confirm new users receive profile rows through the `on_auth_user_created_create_profile` trigger.

## Admin Bootstrap

Admin pages are protected by `profiles.is_admin`. After an admin user exists in Supabase Auth and has a profile row, update that user's profile in Supabase.

```sql
update public.profiles
set is_admin = true
where email = 'admin@example.com';
```

Use the smallest possible admin group. Revoke admin access with:

```sql
update public.profiles
set is_admin = false
where email = 'admin@example.com';
```

## Dodo Payments

Use the Dodo Payments test environment until the full flow has been verified.

1. Create or open a Dodo Payments account.
2. Create the three support products used by the site.
3. Copy the test API key to `DODO_PAYMENTS_API_KEY`.
4. Set `DODO_PAYMENTS_ENV=test`.
5. Copy each product ID into `DODO_PRODUCT_MONTHLY`, `DODO_PRODUCT_QUARTERLY`, and `DODO_PRODUCT_YEARLY`.
6. Add a webhook endpoint:
   - Local through a tunnel: `https://your-tunnel.example/api/webhooks/dodo`
   - Production: `https://your-domain.com/api/webhooks/dodo`
7. Copy the webhook signing key to `DODO_PAYMENTS_WEBHOOK_KEY`.
8. Create a contribution from `/en/contributions` and confirm the webhook inserts a paid record, generates certificates, and updates the cloud sync entitlement.

The app creates Dodo checkout sessions dynamically from `src/config/site.ts` support tiers. Keep the code tiers, Dodo product mapping, and database seed tiers aligned when changing amounts.

## Vercel

1. Import the Git repository into Vercel.
2. Use the default Next.js framework settings.
3. Add every variable from `.env.example` under Project Settings > Environment Variables.
4. Use sandbox/test credentials for preview environments.
5. Use production credentials only in the production environment.
6. Deploy a preview build, then run:

```bash
npm run lint
npm test
npm run build
```

Vercel will run the production build during deployment. Keep `NEXT_PUBLIC_SITE_URL` aligned with the environment being tested because checkout redirects use it instead of the request origin.

## DNS and Custom Domain

Use a custom domain for user trust and payment provider configuration.

1. Add the domain in Vercel Project Settings > Domains.
2. Follow Vercel's DNS instructions for apex and `www` records.
3. Wait for HTTPS certificate provisioning.
4. Set `NEXT_PUBLIC_SITE_URL=https://your-domain.com` in Vercel production variables.
5. Update Supabase Auth redirect allowlists.
6. Update the Dodo webhook URL to the custom domain.
7. Keep one canonical domain and redirect alternates to it.

For domestic and overseas access, verify the domain resolves reliably from expected user regions before launch. If domestic access is a hard requirement in a restricted network environment, validate Vercel reachability early and consider a region-specific mirror or alternate hosting path before production launch.

## Security Notes

- Do not commit `.env.local`, live provider secrets, Supabase service role keys, or webhook secrets.
- Only variables prefixed with `NEXT_PUBLIC_` may be read by browser code.
- Keep `SUPABASE_SERVICE_ROLE_KEY` limited to server routes and server utilities.
- Keep Supabase RLS enabled. The anon key relies on RLS policies for data protection.
- Rotate Dodo Payments and Supabase service role secrets after accidental exposure or staff changes.
- Use separate test/sandbox and live credentials.
- Verify webhook signatures before trusting provider events. The current Dodo webhook route performs signature verification.
- Restrict admin access to named users and audit admin changes manually until a fuller admin workflow exists.
- Do not treat public download URLs as proof of payment. Contributions are voluntary and downloads are public.

## Production Checklist

- [ ] Supabase migrations applied in order.
- [ ] Supabase Auth providers configured and redirect URLs allow local, preview, and production domains.
- [ ] Interactive login UI and auth callback route verified against production Auth providers.
- [ ] First admin user exists in Supabase Auth and `profiles.is_admin` set to `true`.
- [ ] Vercel production environment variables are complete and use live credentials.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the production custom domain.
- [ ] Dodo live webhook points to `/api/webhooks/dodo` and has the live signing key configured.
- [ ] Dodo test contribution creates a paid record and certificate in a non-production environment.
- [ ] Public download links point to the intended release assets.
- [ ] DNS, HTTPS, apex, and `www` behavior are verified.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass on the deployment branch.
- [ ] The team has documented who owns payment accounts, Supabase access, Vercel access, and secret rotation.
