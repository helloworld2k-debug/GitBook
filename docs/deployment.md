# Deployment

This guide covers a low-cost deployment path for the Three Friends software donation site. It assumes Vercel for the Next.js app, Supabase for Auth and Postgres, Stripe for card checkout, and PayPal for PayPal checkout scaffolding.

The current codebase is a deployable baseline, not a finished production launch. Stripe payment persistence and certificate generation are wired through the Stripe webhook. The login page is still a placeholder, and PayPal payments are not yet persisted to the `donations` table or used to generate certificates.

## Services

- **Vercel:** hosts the Next.js application and API routes.
- **Supabase:** provides Postgres, row-level security, Auth, and server-side admin access.
- **Stripe:** creates hosted checkout sessions and sends payment webhooks.
- **PayPal:** creates hosted checkout orders, verifies webhooks, and captures approved orders. Donation persistence and certificate issuance still need to be completed before PayPal is enabled for real users.
- **GitHub Releases or object storage:** hosts public software downloads. The current app points download links at release URLs in `src/config/site.ts`.

This stack keeps fixed costs low: Vercel and Supabase can start on their free or low-cost tiers, while Stripe and PayPal charge transaction fees. For domestic and overseas users, use a custom domain, keep the app globally hosted on Vercel, and offer provider choices only after each provider has passed end-to-end persistence and certificate checks.

## Environment Variables

Copy `.env.example` to `.env.local` for local development and set the same names in Vercel project settings for preview and production deployments.

| Name | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical app URL. Use `http://localhost:3000` locally and `https://your-domain.com` in production. Checkout redirects use this value. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL. Safe for browser use. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon public key. Safe for browser use with RLS enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key for webhooks and certificate generation. Never expose it to client code. |
| `STRIPE_SECRET_KEY` | Server only | Stripe secret key. Use test mode locally and live mode in production. |
| `STRIPE_WEBHOOK_SECRET` | Server only | Signing secret for the Stripe webhook endpoint. |
| `PAYPAL_CLIENT_ID` | Server only | PayPal REST app client ID. |
| `PAYPAL_CLIENT_SECRET` | Server only | PayPal REST app client secret. |
| `PAYPAL_WEBHOOK_ID` | Server only | PayPal webhook ID used during signature verification. |
| `PAYPAL_BASE_URL` | Server only | Use `https://api-m.sandbox.paypal.com` for sandbox and `https://api-m.paypal.com` for live. |

## Setup Order

1. Create the Supabase project.
2. Apply database migrations in order from `supabase/migrations`.
3. Configure Supabase Auth and allowed redirect URLs.
4. Create Stripe and PayPal sandbox apps and webhooks.
5. Create the Vercel project and add all environment variables.
6. Deploy to Vercel preview and run sandbox checkout verification for each provider that is enabled.
7. Bootstrap the first admin user in Supabase.
8. Attach the production domain and update provider callback/webhook allowlists.
9. Switch Stripe, and PayPal only after its persistence work is complete, from sandbox/test credentials to live credentials.
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

The migrations create profiles, donation tiers, sponsor levels, donations, certificates, admin audit logs, row-level security policies, and certificate number functions.

Configure Auth:

- Enable the sign-in methods the handoff team wants to support.
- Complete the interactive login UI and auth callback route before relying on donation or admin flows through the browser. The current login page is explanatory placeholder content.
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

## Stripe

Use Stripe test mode until the full flow has been verified.

1. Create or open a Stripe account.
2. Copy the test secret key to `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint:
   - Local with Stripe CLI: `http://localhost:3000/api/webhooks/stripe`
   - Production: `https://your-domain.com/api/webhooks/stripe`
4. Subscribe at minimum to `checkout.session.completed`.
5. Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET`.
6. Create a donation from `/en/donate` and confirm the webhook inserts a paid donation and generates certificates.

The app creates Stripe Checkout Sessions dynamically from `src/config/site.ts` donation tiers. Keep the code tiers and database seed tiers aligned when changing amounts.

## PayPal

Use PayPal sandbox until the full flow has been verified.

1. Create a PayPal REST app in the developer dashboard.
2. Copy the sandbox client ID and secret to `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
3. Set `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`.
4. Add a webhook endpoint:
   - Local through a tunnel: `https://your-tunnel.example/api/webhooks/paypal`
   - Production: `https://your-domain.com/api/webhooks/paypal`
5. Subscribe to:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
6. Copy the webhook ID to `PAYPAL_WEBHOOK_ID`.
7. Run a sandbox checkout and confirm PayPal approval redirects back to the dashboard.

Before enabling PayPal for real users, complete PayPal donation persistence so a captured PayPal payment inserts a paid `donations` row and generates certificates just like Stripe. Until then, treat PayPal as checkout/webhook scaffolding only.

For live mode, replace credentials with live app credentials and set `PAYPAL_BASE_URL=https://api-m.paypal.com`.

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
6. Update Stripe and PayPal webhook URLs to the custom domain.
7. Keep one canonical domain and redirect alternates to it.

For domestic and overseas access, verify the domain resolves reliably from expected user regions before launch. If domestic access is a hard requirement in a restricted network environment, validate Vercel reachability early and consider a region-specific mirror or alternate hosting path before production launch.

## Security Notes

- Do not commit `.env.local`, live provider secrets, Supabase service role keys, or webhook secrets.
- Only variables prefixed with `NEXT_PUBLIC_` may be read by browser code.
- Keep `SUPABASE_SERVICE_ROLE_KEY` limited to server routes and server utilities.
- Keep Supabase RLS enabled. The anon key relies on RLS policies for data protection.
- Rotate Stripe, PayPal, and Supabase service role secrets after accidental exposure or staff changes.
- Use separate test/sandbox and live credentials.
- Verify webhook signatures before trusting provider events. The current Stripe and PayPal webhook routes perform signature verification.
- Restrict admin access to named users and audit admin changes manually until a fuller admin workflow exists.
- Do not treat public download URLs as proof of payment. Donations are voluntary and downloads are public.

## Production Checklist

- [ ] Supabase migrations applied in order.
- [ ] Supabase Auth providers configured and redirect URLs allow local, preview, and production domains.
- [ ] Interactive login UI and auth callback route implemented and verified.
- [ ] First admin user exists in Supabase Auth and `profiles.is_admin` set to `true`.
- [ ] Vercel production environment variables are complete and use live credentials.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the production custom domain.
- [ ] Stripe live webhook points to `/api/webhooks/stripe` and has the live signing secret configured.
- [ ] Stripe test donation creates a paid donation and certificate in a non-production environment.
- [ ] PayPal persistence is implemented before PayPal is shown to real users.
- [ ] PayPal sandbox donation creates a paid donation and certificate in a non-production environment before live PayPal credentials are enabled.
- [ ] Public download links point to the intended release assets.
- [ ] DNS, HTTPS, apex, and `www` behavior are verified.
- [ ] `npm run lint`, `npm test`, and `npm run build` pass on the deployment branch.
- [ ] The team has documented who owns payment accounts, Supabase access, Vercel access, and secret rotation.
