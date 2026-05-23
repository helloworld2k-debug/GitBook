# Admin Payment Settings Design

## Goal

Admins can manage Dodo Payments product IDs from the admin console instead of changing code or deployment variables for every product change.

## Scope

- Add payment product settings to the admin contribution pricing page.
- Store Dodo product IDs for both `test` and `live` environments in the database.
- Keep public production checkout pinned to live products when `DODO_PAYMENTS_ENV=live`.
- Allow admins to select test or live while saving settings and later verifying a checkout configuration.
- Keep environment variables as a fallback so current deployments keep working before the new table is populated.

## Data Model

Create `payment_product_settings` with one row per provider, environment, and tier:

- `provider`: `dodo`
- `environment`: `test` or `live`
- `tier_code`: `monthly`, `quarterly`, or `yearly`
- `product_id`: Dodo product ID
- `is_enabled`: whether the setting is usable
- audit columns: `created_at`, `updated_at`, `updated_by`

The table is service-role writable. Admin UI updates go through server actions that require admin access and write admin audit logs.

## Runtime Behavior

Checkout and webhook validation resolve product IDs through a helper:

1. Try the database row matching provider, environment, and tier.
2. Fall back to environment variables for compatibility.
3. For `DODO_PAYMENTS_ENV=live`, live database rows or live env vars are used.
4. Admin test tools may request either environment explicitly, but that does not change public checkout.

## Admin UI

The existing contribution pricing page gets a payment settings section below support tier pricing. It shows a segmented choice for test/live and three product ID inputs for monthly, quarterly, and yearly.

Saving a row updates only that environment and tier, then revalidates the admin page and checkout surface.

## Error Handling

- Product IDs are required to save enabled rows.
- Product IDs must look like Dodo product IDs (`pdt_...`).
- If the database is unavailable, runtime checkout falls back to existing env vars.
- If no usable product ID exists, checkout returns the existing invalid-tier error path.

## Tests

- Unit test product ID resolution prefers database settings and falls back to env vars.
- Unit test live checkout uses live IDs when configured.
- Unit test admin page renders test/live Dodo product inputs.
- Unit test admin action validates and upserts product settings.
- Migration test covers the new table and unique constraint.
