# GitBook AI Desktop License Design

## Summary

GitBook AI desktop software and the website will share the same user identity system. The desktop app remains free to download and use for basic reading and basic resource downloads. The first paid entitlement controls only one advanced feature: cloud sync.

The desktop app will not read Supabase tables directly and will not collect passwords. It will use browser-based website login, exchange a short-lived desktop auth code for a desktop session token, and call a website license API whenever the user tries to enable or use cloud sync.

## Confirmed Product Rules

- Basic software usage is free.
- Basic resource downloads are free.
- Cloud sync is the only advanced feature in the first version.
- Cloud sync requires the user to be registered, logged in, online, and inside either a valid donation entitlement period or a valid new-user trial.
- New registered users receive a 3-day cloud sync trial.
- Trial eligibility is bound to the computer machine code. One machine code can receive the 3-day trial only once, even if a different account logs in later on the same computer.
- A user can log in on multiple computers, but only one device can actively use cloud sync at a time.
- If device B starts using cloud sync while device A is active on the same account, device A immediately loses cloud sync access on its next license check or heartbeat.
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
- Machine-code trial eligibility.
- Desktop auth code exchange.
- Desktop session validation.
- Single-active-device cloud sync leasing.
- License status API.
- Admin license management.

### Desktop App

The desktop app owns:

- Opening the browser login flow.
- Receiving the custom protocol callback.
- Storing the desktop session token securely.
- Sending the computer machine code with desktop auth exchange and license checks.
- Calling the license status API before enabling cloud sync.
- Sending a heartbeat while cloud sync is active.
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

### New Table: `machine_trial_claims`

Stores one-time 3-day trial claims by computer machine code.

Recommended fields:

- `id`
- `machine_code_hash`
- `user_id`
- `feature_code`, first version fixed to `cloud_sync`
- `trial_started_at`
- `trial_valid_until`
- `created_at`

The database must enforce a unique constraint on `(machine_code_hash, feature_code)`. This prevents the same computer from receiving another 3-day trial by switching accounts.

The raw machine code should not be stored. The server should store a salted hash. The desktop app sends the machine code over HTTPS during auth exchange and license checks.

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
- `machine_code_hash`
- `platform`
- `app_version`
- `last_seen_at`
- `cloud_sync_active_until`
- `expires_at`
- `revoked_at`
- `created_at`

The first version allows multiple device logins but enforces one active cloud sync lease per user.

### New Table: `desktop_devices`

Stores observed device metadata.

Recommended fields:

- `id`
- `user_id`
- `device_id`
- `machine_code_hash`
- `platform`
- `device_name`
- `app_version`
- `last_seen_at`
- `revoked_at`
- `created_at`

This gives admins visibility and supports machine-code trial enforcement. It does not limit how many computers can log in.

### New Table: `cloud_sync_leases`

Stores the single active cloud sync device lease for each user.

Recommended fields:

- `id`
- `user_id`
- `desktop_session_id`
- `device_id`
- `machine_code_hash`
- `lease_started_at`
- `last_heartbeat_at`
- `expires_at`
- `revoked_at`
- `created_at`
- `updated_at`

The database should enforce only one non-revoked lease per user. Starting cloud sync on a new device revokes or replaces the previous lease. A short lease window, such as 60-120 seconds, lets the server recover automatically if a device crashes without sending a release request.

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

## Trial Calculation

When a registered user logs in from the desktop app and requests cloud sync for the first time, the server checks `machine_trial_claims`.

If no row exists for the machine code and `cloud_sync`, the server creates a trial:

- `trial_started_at = now()`
- `trial_valid_until = now() + 3 days`
- `user_id = current user`

If a row already exists for the machine code and `cloud_sync`, no new trial is created, even if the current user is different from the original trial user.

The license status API treats a valid trial like a temporary entitlement for `cloud_sync`. Paid donation entitlement takes priority if both exist.

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

8. Desktop app includes device metadata and machine code in the exchange request.
9. Website validates the code, records the device/session, hashes the machine code, and returns a desktop session token.
10. Desktop app stores the token securely and uses it for future license checks.

## License Status API

Endpoint:

`GET /api/license/status?feature=cloud_sync`

Authentication:

The desktop app sends the desktop session token in an authorization header.

The desktop app also sends the current machine code or a stable machine-code proof so the server can enforce one-time trial rules. The server hashes the machine code before comparing or storing it.

Successful active response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": true,
  "validUntil": "2026-08-30T00:00:00Z",
  "remainingDays": 121,
  "source": "paid",
  "activeDeviceId": "device_a",
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
- `trial_active`
- `trial_expired`
- `machine_trial_used`
- `active_on_another_device`
- `network_required`
- `unsupported_feature`

## Cloud Sync Lease API

Cloud sync needs an active lease so one account can use the advanced feature on only one device at a time.

### Start or Take Over Lease

Endpoint:

`POST /api/license/cloud-sync/activate`

Behavior:

- Validates desktop session token.
- Checks paid entitlement or valid trial.
- Revokes/replaces any existing active lease for the same user.
- Creates a new lease for the current device/session.
- Returns `allowed: true` for the current device.

If device B activates cloud sync while device A has an active lease, device B becomes active immediately. Device A will receive `active_on_another_device` on its next heartbeat or license status check.

### Heartbeat

Endpoint:

`POST /api/license/cloud-sync/heartbeat`

Behavior:

- Validates desktop session token.
- Confirms the current device/session still owns the active lease.
- Extends `expires_at` by a short period, such as 60-120 seconds.
- Returns denied if another device has taken over.

### Release

Endpoint:

`POST /api/license/cloud-sync/release`

Behavior:

- Marks the current lease revoked when the user turns off cloud sync or logs out.
- If the app crashes, the lease expires automatically by `expires_at`.

## Desktop App Behavior

- Not logged in: show a sign-in prompt before cloud sync can be enabled.
- No entitlement: explain that cloud sync is available to active supporters.
- Expired entitlement: prompt the user to renew support to restore cloud sync.
- Active entitlement: enable the cloud sync switch.
- Active trial: enable the cloud sync switch and show the trial expiry date.
- Machine trial already used and no paid entitlement: prompt the user to support development to enable cloud sync.
- Active on another device: turn off cloud sync locally and explain that another computer is now using cloud sync.
- Network error: keep cloud sync unavailable and explain that online verification is required.
- Basic reading and basic resource downloads continue to work without license checks.

## Admin Management

Add an admin page:

`/[locale]/admin/licenses`

Capabilities:

- Search by user email.
- View cloud sync entitlement status.
- View trial claim status by machine code hash.
- View `valid_until`, remaining days, and source donation.
- View desktop device/session records.
- View active cloud sync lease and last heartbeat.
- Manually extend entitlement.
- Manually revoke entitlement.
- Manually revoke a desktop session or active cloud sync lease.
- Trigger entitlement recalculation after refund or correction.
- Write all manual changes to the existing admin audit log.

## Error Handling

- Expired or used desktop auth codes are rejected.
- Invalid desktop tokens return `not_authenticated`.
- Revoked desktop sessions return `not_authenticated`.
- Revoked entitlements return `revoked`.
- Expired trials return `trial_expired`.
- Machine codes that already claimed a trial under any account return `machine_trial_used` when no paid entitlement exists.
- Devices that no longer own the cloud sync lease return `active_on_another_device`.
- Unsupported features return `unsupported_feature`.
- Network errors are handled by the desktop app as `network_required`; the API itself does not need to return that reason unless a gateway layer detects it.

## Security Notes

- Desktop app never stores website passwords.
- Desktop app never stores Supabase service keys.
- Desktop app does not query Supabase directly.
- Auth codes are single-use and expire quickly.
- Desktop session tokens are stored hashed in the database.
- Desktop session tokens can be revoked by the server.
- Machine codes are stored as salted hashes, not raw identifiers.
- Trial uniqueness is enforced by `machine_code_hash` and feature.
- Device records do not limit logins, but cloud sync leases enforce one active advanced-feature device per account.
- Lease heartbeats prevent long-term lockout when a device crashes.

## Testing Plan

### Unit Tests

- Entitlement day mapping for monthly, quarterly, yearly.
- Entitlement stacking when the user is currently active.
- Entitlement starting from now when the user is expired.
- Refunded/cancelled/failed donations do not count.
- License status returns active, expired, no entitlement, revoked, and unauthenticated states.
- Trial creation succeeds once per machine code.
- Trial creation is blocked for a machine code that has already claimed `cloud_sync`, even under a different user.
- Paid entitlement takes priority over trial state.
- Cloud sync activation replaces the previous active device lease.
- Heartbeat from a replaced device returns `active_on_another_device`.
- Auth exchange rejects expired, used, invalid, and mismatched codes.

### API Tests

- `POST /api/desktop/auth/exchange` returns a desktop token for a valid code.
- `GET /api/license/status?feature=cloud_sync` returns allowed for active entitlement.
- The same endpoint returns allowed for active trial.
- The same endpoint returns denied for expired entitlement.
- `POST /api/license/cloud-sync/activate` grants the lease to the latest device.
- `POST /api/license/cloud-sync/heartbeat` denies a device after another device takes over.
- Revoked session tokens cannot access license status.

### E2E Tests

- Browser desktop-login URL can complete login and return a desktop callback code.
- A desktop session with active entitlement can enable cloud sync.
- A new user can use a 3-day cloud sync trial on a machine code that has never claimed a trial.
- A second account on the same machine code cannot claim another 3-day trial.
- When device B activates cloud sync, device A loses cloud sync on heartbeat.
- A desktop session with expired entitlement cannot enable cloud sync.
- Basic public download and reading paths remain unaffected.

## First Implementation Scope

The first implementation should include:

1. Database migration for license entitlement, machine trial claim, desktop auth code, desktop session, desktop device, and cloud sync lease tables.
2. Entitlement calculation service.
3. Machine-code trial claim service.
4. Stripe/manual donation success integration that extends `cloud_sync`.
5. Desktop login callback and auth-code exchange API.
6. License status API.
7. Cloud sync activate, heartbeat, and release APIs.
8. Admin license page.
9. Unit/API/E2E coverage for the core license and lease flow.

Out of scope for the first implementation:

- Actual cloud sync data storage.
- Device login count enforcement.
- Offline grace period.
- License checks for basic reading or basic resource downloads.
- Auto-renewing subscriptions.
- Native desktop UI implementation.
