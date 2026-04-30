# GitBook AI Desktop License Design

## Summary

GitBook AI desktop software and the website will share the same user identity system. The desktop app remains free to download and use for basic reading and basic resource downloads. The first paid entitlement controls only one advanced feature: cloud sync.

The desktop app will not read Supabase tables directly and will not collect passwords. It will use browser-based website login, exchange a short-lived desktop auth code for a desktop session token, and call a website license API whenever the user tries to enable or use cloud sync.

## Confirmed Product Rules

- Basic software usage is free.
- Basic resource downloads are free.
- Cloud sync is the only advanced feature in the first version.
- Cloud sync requires the user to be registered, logged in, online, and inside a valid donation entitlement period.
- Desktop devices are recorded but not limited in the first version.
- Cloud sync cannot be used offline. A network error means the advanced feature is unavailable until the server can verify the entitlement.
- Multiple paid donations stack. If a user still has 20 valid days and donates for one year, the new remaining period becomes about 385 days.
- Donation tiers map to entitlement days:
  - monthly: 30 days
  - quarterly: 90 days
  - yearly: 365 days

## Recommended Approach

Use the website as the only license authority.

The desktop app asks the website whether `cloud_sync` is currently allowed. The app does not calculate donation time, does not inspect donation records, and does not know the business rules beyond showing the server response. This keeps licensing secure and lets the website change rules later without forcing every user to update the desktop app.

## Architecture

### Website

The website owns:

- Supabase Auth user identity.
- Donation records.
- Entitlement calculation.
- Desktop auth code exchange.
- Desktop session validation.
- License status API.
- Admin license management.

### Desktop App

The desktop app owns:

- Opening the browser login flow.
- Receiving the custom protocol callback.
- Storing the desktop session token securely.
- Calling the license status API before enabling cloud sync.
- Showing user-facing states such as login required, expired, active, or network required.

### Supabase

Supabase remains the system of record for auth users, profiles, donations, certificates, and new license tables.

## Data Model

### Existing Source Tables

`donations` remains the payment fact table. Only `status = paid` records grant time. `pending`, `failed`, `cancelled`, and `refunded` do not count toward the active entitlement.

### New Table: `license_entitlements`

Stores the server-calculated result for each user and feature.

Recommended fields:

- `id`
- `user_id`
- `feature_code`, first version fixed to `cloud_sync`
- `valid_until`
- `status`: `active`, `expired`, `revoked`
- `source_donation_id`
- `created_at`
- `updated_at`

This table lets `/api/license/status` answer quickly without scanning every donation on every request.

### New Table: `desktop_auth_codes`

Stores one-time browser login codes for the desktop app.

Recommended fields:

- `id`
- `code_hash`
- `user_id`
- `device_session_id`
- `return_url`
- `expires_at`
- `used_at`
- `created_at`

Codes are short-lived, single-use, and exchanged by the desktop app for a desktop session token.

### New Table: `desktop_sessions`

Stores desktop app sessions.

Recommended fields:

- `id`
- `user_id`
- `token_hash`
- `device_id`
- `platform`
- `app_version`
- `last_seen_at`
- `expires_at`
- `revoked_at`
- `created_at`

The first version records devices and sessions but does not limit device count.

### New Table: `desktop_devices`

Stores observed device metadata.

Recommended fields:

- `id`
- `user_id`
- `device_id`
- `platform`
- `device_name`
- `app_version`
- `last_seen_at`
- `revoked_at`
- `created_at`

This gives admins visibility and leaves room for future device limits.

## Entitlement Calculation

When a paid donation is created or confirmed, the server updates the user's `cloud_sync` entitlement.

For each paid donation:

1. Find the tier code.
2. Convert the tier to entitlement days.
3. Find the current `valid_until` for the user's `cloud_sync` entitlement.
4. Use the later of `now()` and `valid_until` as the start point.
5. Add the tier days.
6. Save the new `valid_until`.

Refunds or manual revocations should either mark the related entitlement as revoked or trigger a recalculation from the remaining valid paid donation records. Recalculation is safer for accuracy when there are multiple donations.

## Desktop Login Flow

1. User clicks `Sign in` in the desktop app.
2. Desktop app generates `device_session_id` and a custom protocol return URL such as `gitbookai://auth/callback`.
3. Desktop app opens:

   `https://gitbook.us.ci/en/login?client=desktop&device_session_id=...&return_url=gitbookai://auth/callback`

4. User logs in on the website using email/password or OAuth.
5. Website creates a short-lived `desktop_auth_code`.
6. Browser redirects back to:

   `gitbookai://auth/callback?code=...`

7. Desktop app calls:

   `POST /api/desktop/auth/exchange`

8. Website validates the code and returns a desktop session token.
9. Desktop app stores the token securely and uses it for future license checks.

## License Status API

Endpoint:

`GET /api/license/status?feature=cloud_sync`

Authentication:

The desktop app sends the desktop session token in an authorization header.

Successful active response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": true,
  "validUntil": "2026-08-30T00:00:00Z",
  "remainingDays": 121,
  "reason": "active"
}
```

Expired response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": false,
  "validUntil": "2026-04-30T00:00:00Z",
  "remainingDays": 0,
  "reason": "expired"
}
```

Unauthenticated response:

```json
{
  "authenticated": false,
  "feature": "cloud_sync",
  "allowed": false,
  "reason": "not_authenticated"
}
```

Supported `reason` values for the first version:

- `active`
- `not_authenticated`
- `no_entitlement`
- `expired`
- `revoked`
- `network_required`
- `unsupported_feature`

## Desktop App Behavior

- Not logged in: show a sign-in prompt before cloud sync can be enabled.
- No entitlement: explain that cloud sync is available to active supporters.
- Expired entitlement: prompt the user to renew support to restore cloud sync.
- Active entitlement: enable the cloud sync switch.
- Network error: keep cloud sync unavailable and explain that online verification is required.
- Basic reading and basic resource downloads continue to work without license checks.

## Admin Management

Add an admin page:

`/[locale]/admin/licenses`

Capabilities:

- Search by user email.
- View cloud sync entitlement status.
- View `valid_until`, remaining days, and source donation.
- View desktop device/session records.
- Manually extend entitlement.
- Manually revoke entitlement.
- Trigger entitlement recalculation after refund or correction.
- Write all manual changes to the existing admin audit log.

## Error Handling

- Expired or used desktop auth codes are rejected.
- Invalid desktop tokens return `not_authenticated`.
- Revoked desktop sessions return `not_authenticated`.
- Revoked entitlements return `revoked`.
- Unsupported features return `unsupported_feature`.
- Network errors are handled by the desktop app as `network_required`; the API itself does not need to return that reason unless a gateway layer detects it.

## Security Notes

- Desktop app never stores website passwords.
- Desktop app never stores Supabase service keys.
- Desktop app does not query Supabase directly.
- Auth codes are single-use and expire quickly.
- Desktop session tokens are stored hashed in the database.
- Desktop session tokens can be revoked by the server.
- Device records are observational in version one and do not enforce a limit.

## Testing Plan

### Unit Tests

- Entitlement day mapping for monthly, quarterly, yearly.
- Entitlement stacking when the user is currently active.
- Entitlement starting from now when the user is expired.
- Refunded/cancelled/failed donations do not count.
- License status returns active, expired, no entitlement, revoked, and unauthenticated states.
- Auth exchange rejects expired, used, invalid, and mismatched codes.

### API Tests

- `POST /api/desktop/auth/exchange` returns a desktop token for a valid code.
- `GET /api/license/status?feature=cloud_sync` returns allowed for active entitlement.
- The same endpoint returns denied for expired entitlement.
- Revoked session tokens cannot access license status.

### E2E Tests

- Browser desktop-login URL can complete login and return a desktop callback code.
- A desktop session with active entitlement can enable cloud sync.
- A desktop session with expired entitlement cannot enable cloud sync.
- Basic public download and reading paths remain unaffected.

## First Implementation Scope

The first implementation should include:

1. Database migration for license entitlement, desktop auth code, desktop session, and desktop device tables.
2. Entitlement calculation service.
3. Stripe/manual donation success integration that extends `cloud_sync`.
4. Desktop login callback and auth-code exchange API.
5. License status API.
6. Admin license page.
7. Unit/API/E2E coverage for the core license flow.

Out of scope for the first implementation:

- Actual cloud sync data storage.
- Device count enforcement.
- Offline grace period.
- License checks for basic reading or basic resource downloads.
- Auto-renewing subscriptions.
- Native desktop UI implementation.
