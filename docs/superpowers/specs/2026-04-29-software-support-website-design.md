# Software Support Website Design

Date: 2026-04-29

## Summary

Build an international software download website with public downloads, required login before contribution, one-time voluntary contribution tiers, contribution records, and managed certificates. The default language is English, with Chinese (`zh-Hant`), Japanese, and Korean supported from the first version.

The support model is voluntary support for development. Contributions do not unlock software access, paid features, or licenses. The account system exists to bind contributions to users, generate certificates, and let users manage recognition preferences.

## Confirmed Product Decisions

- Downloads are public and do not require login.
- Support requires registration or login before payment.
- Support tiers are one-time payments labeled as monthly, quarterly, and yearly support.
- Stripe and PayPal are the first payment providers.
- Login supports email magic link plus Google, GitHub, and Apple.
- Users can view contribution history, per-contribution certificates, and cumulative honor certificates.
- Certificate numbers are generated and managed only by the backend/admin system.
- Admin features are intentionally lightweight for the first version.
- Deployment uses Vercel with Supabase for authentication and database.

## Languages and Routes

The site uses locale-prefixed routes:

- `/en`
- `/zh-Hant`
- `/ja`
- `/ko`

English is the default language. All user-facing product text, support copy, payment status messages, certificate text, emails, legal pages, and dashboard labels must be localizable.

Language switcher labels must be short and region-aware:

- English: `English`
- `zh-Hant`: `中文`, shown with the Hong Kong icon.
- Japanese: `日本語`
- Korean: `한국어`

## Page Structure

### Public Pages

- Home and download page: product introduction, latest version, OS download buttons, release notes, and support prompt.
- Support page: one-time support tiers, Stripe and PayPal checkout entry points, and clear wording that contributions do not auto-renew.
- Sponsors page: optional public supporter wall with privacy controls.
- Legal and policy pages: privacy policy, terms, contribution explanation, and refund explanation.

### Account Pages

- Sign in and registration page: magic link, Google, GitHub, and Apple.
- Dashboard: profile summary, contribution history, certificate list, cumulative supporter level, and public display settings.
- Certificate detail page: certificate number, recipient display name, support tier or honor level, issue date, project name, and downloadable PNG/PDF export.

### Admin Pages

- Users: view user profiles and public display settings.
- Contributions: view payment records, status, provider, amount, currency, and provider transaction ID.
- Certificates: view, regenerate certificate files, revoke certificates, and generate certificates for manually added contributions.
- Manual corrections: add or correct contribution records with required source notes.
- Audit logs: list all admin changes related to contributions and certificates.

## User Flow

### Download Flow

1. Visitor lands on the home/download page.
2. Visitor chooses the correct OS download button.
3. File download starts or the user is taken to the release asset.
4. The page shows a non-blocking support prompt near the download area.

### Support Flow

1. User clicks a support tier.
2. System checks authentication.
3. If the user is not logged in, redirect to sign in/register.
4. After login, return to the support page or selected tier.
5. User chooses Stripe or PayPal.
6. Checkout metadata includes `user_id`, `tier`, `locale`, `amount`, and `currency`.
7. Payment provider redirects back to a success or cancelled page.
8. Webhook confirms payment and creates or updates the contribution record.
9. Backend certificate service generates certificate numbers and certificate records.
10. Dashboard shows the completed contribution and certificates.

### Certificate Flow

1. A successful contribution triggers certificate generation on the backend.
2. A per-contribution certificate is created for the specific payment.
3. The cumulative sponsor level is recalculated.
4. If the cumulative level changes, an honor certificate is created or updated.
5. Users can view and download certificate renderings.
6. Admins can revoke certificates or regenerate certificate files, but cannot manually overwrite existing certificate numbers.

## Recommended Technical Architecture

- Framework: Next.js App Router with TypeScript.
- Deployment: Vercel.
- Authentication: Supabase Auth.
- Database: Supabase Postgres.
- Payments: Stripe Checkout and PayPal Checkout.
- Internationalization: `next-intl`.
- Styling: Tailwind CSS or a small component system built on Tailwind.
- Emails: Supabase Auth email for the first version; Resend can be added later for branded transactional email.
- Certificates: server-rendered certificate pages with PNG/PDF export.
- Admin authorization: role or admin flag stored in Supabase and checked server-side.

## Data Model

### `profiles`

Stores user profile data linked to Supabase Auth.

Key fields:

- `id`
- `email`
- `display_name`
- `avatar_url`
- `preferred_locale`
- `public_supporter_enabled`
- `public_display_name`
- `is_admin`
- `created_at`
- `updated_at`

### `support_tiers`

Stores active one-time voluntary contribution tiers.

Key fields:

- `id`
- `code`
- `label`
- `description`
- `amount`
- `currency`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

Initial tier labels:

- Monthly Support
- Quarterly Support
- Yearly Support

These labels do not imply recurring billing.

### `contributions`

Stores contribution payment records.

Key fields:

- `id`
- `user_id`
- `tier_id`
- `amount`
- `currency`
- `provider`
- `provider_transaction_id`
- `status`
- `paid_at`
- `metadata`
- `created_at`
- `updated_at`

Provider transaction IDs must be unique per provider to make webhook handling idempotent.

### `sponsor_levels`

Stores cumulative contribution levels.

Key fields:

- `id`
- `code`
- `label`
- `minimum_total_amount`
- `currency`
- `sort_order`
- `is_active`

Example levels:

- Bronze
- Silver
- Gold
- Platinum

Exact thresholds can be configured during implementation.

### `certificates`

Stores certificate records. Certificate numbers are backend-generated and unique.

Key fields:

- `id`
- `certificate_number`
- `user_id`
- `contribution_id`
- `sponsor_level_id`
- `type`
- `status`
- `issued_at`
- `revoked_at`
- `render_version`
- `created_at`
- `updated_at`

Certificate types:

- `contribution`: one certificate for an individual successful contribution.
- `honor`: cumulative contribution certificate.

Example certificate numbers:

- `TFD-2026-C-000001`
- `TFD-2026-H-000001`

The implementation must use a database sequence, transaction, or equivalent server-side mechanism to avoid duplicate numbers under concurrent payments.

### `admin_audit_logs`

Stores admin actions.

Key fields:

- `id`
- `admin_user_id`
- `action`
- `target_type`
- `target_id`
- `before`
- `after`
- `reason`
- `created_at`

## Permissions

- Anonymous visitors can view public pages and download software.
- Anonymous visitors cannot start payment checkout.
- Authenticated users can view and edit their own profile.
- Authenticated users can view their own contributions and certificates.
- Public sponsor pages show only users who opt in.
- Admin pages require server-side admin checks.
- Admin changes to contributions and certificates must be audit logged.
- Payment webhooks use server-side secrets and never trust client-submitted payment status.

## Error Handling

- Login required for contribution: redirect to login and return to the selected support tier after authentication.
- Checkout cancelled: return to the support page with a non-destructive cancelled state.
- Webhook delayed: dashboard can show a pending state while payment confirmation is processing.
- Duplicate webhook: ignore or update idempotently using provider and provider transaction ID.
- Certificate generation failure: keep the contribution record paid, mark certificate generation as failed, and expose retry in admin.
- Admin correction: require a reason and write an audit log entry.
- User hides public supporter status: remove the user from public sponsor listings immediately.

## UI Direction

The visual tone should feel like a professional software product with open-source sponsor culture. Downloads should be the primary visible action. Support should be visible, warm, and trustworthy, but not coercive.

UI guidance:

- Put product name, latest version, OS download buttons, and release notes near the top of the page.
- Keep the support prompt close to the download area without blocking the download.
- On the support page, clearly state that monthly, quarterly, and yearly support are one-time voluntary contributions and do not auto-renew.
- Use a quiet dashboard layout with navigation, contribution records, certificates, and public profile controls.
- Make certificates more ceremonial than the rest of the dashboard, with certificate number, recipient name, issue date, project name, and signature/seal styling.
- Avoid any copy that implies paid access or licensing.

## Admin Scope for Version One

Included:

- View users.
- View contributions.
- View certificates.
- Manually add or correct contribution records.
- Generate certificates for manually added contributions.
- Revoke certificates.
- Regenerate certificate files.
- View audit logs.

Excluded from version one:

- CMS-managed website copy.
- CMS-managed software releases.
- Recurring subscriptions.
- WeChat Pay and Alipay.
- License key generation.
- Paid feature gating.
- In-app entitlement enforcement.

## Testing Strategy

### Unit and Integration Tests

- Locale routing and language fallback.
- Support tier selection.
- Login-required contribution guard.
- Certificate number generation.
- Sponsor level calculation.
- Public supporter visibility rules.
- Admin permission checks.

### Payment Tests

- Stripe checkout success.
- Stripe checkout cancellation.
- Stripe webhook idempotency.
- PayPal checkout success.
- PayPal webhook idempotency.
- Payment webhook with missing or invalid user metadata.

### End-to-End Tests

- Anonymous user downloads software.
- Anonymous user tries to support and is redirected to login.
- Logged-in user completes test contribution and sees dashboard record.
- Certificate appears after payment confirmation.
- User hides public supporter display and disappears from sponsor wall.
- Admin manually corrects a contribution and audit log is written.

## Deployment Plan

Version one uses Vercel and Supabase to minimize operational overhead.

Required services:

- Vercel project.
- Supabase project.
- Stripe account.
- PayPal developer app.
- OAuth apps for Google, GitHub, and Apple.
- Domain and DNS.

Environment variables must be split between public client-safe values and server-only secrets. Webhook secrets and service-role database keys must never be exposed to the browser.

## Cost Notes

Vercel is not guaranteed to be the absolute cheapest server bill, but it is the recommended lowest overall cost for this first version because it reduces deployment and maintenance work.

Expected early-stage cost:

- Trial or validation: potentially free hosting/database tiers plus payment processing fees.
- Formal production: likely Vercel Pro plus Supabase Pro and payment processing fees.

If traffic or cost pressure grows, the architecture can later move to a VPS or cloud container deployment without changing the product model.

## Version One Defaults

Use these defaults for the first implementation unless the product owner changes them before development starts:

- Support currency: USD.
- Support tiers: Monthly Support at USD 5, Quarterly Support at USD 15, and Yearly Support at USD 50.
- Sponsor levels: Bronze from USD 5, Silver from USD 50, Gold from USD 150, and Platinum from USD 500.
- Software release files: GitHub Releases, linked from the public download page.
- Certificate rendering: server-rendered certificate pages with backend-controlled PNG/PDF export.
- Public sponsor wall: included in version one, but users are private by default and must opt in before appearing publicly.
