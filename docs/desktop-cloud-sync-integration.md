# Desktop Cloud Sync Entitlement Integration

This document is for desktop software developers integrating the cloud sync switch with the website account and development support system.

The website does not store or transport cloud sync data. It only authenticates the user, manages development support entitlements, and tells the desktop app whether the cloud sync switch may be enabled.

Desktop sign-in is separate from cloud sync ownership. A user may sign in on a second device, but only one device may have cloud sync enabled at a time.

## Business Rule Summary

Please read this section before implementing the API calls.

- A website account may be signed in on more than one desktop device.
- Signing in successfully does not mean cloud sync may be enabled.
- Cloud sync is a single-device feature: only one desktop device may have cloud sync enabled for the same account at the same time.
- The cloud sync switch must default to off after desktop sign-in.
- When the user turns cloud sync on, the desktop app must call `POST /api/license/cloud-sync/activate` before enabling any local sync process.
- If another device is still actively syncing, activation fails with `active_on_another_device`. The app must keep cloud sync off and tell the user that another device is currently using cloud sync.
- If the previous device has already released cloud sync, the new device still may need to wait for the configured cooldown period. During that period, activation fails with `cooldown_waiting` and includes `availableAfter` plus `remainingSeconds`.
- The default cooldown is 180 minutes, but it is configurable in the website admin system. Do not hard-code 180 minutes in the desktop app.
- The desktop app must display the retry time from the server response. Do not calculate permission from the local computer clock.
- User-level temporary admin overrides may skip only the device-switch cooldown. They do not bypass support entitlement, expired support, disabled accounts, revoked sessions, or other account checks.

Expected user-facing behavior:

1. The user signs in on device B while device A is already using cloud sync.
2. Device B sign-in succeeds, but its cloud sync switch stays off.
3. If the user tries to enable cloud sync on device B while device A is still syncing, show an "another device is currently using cloud sync" message.
4. If device A has turned cloud sync off but the cooldown has not finished, show a "please try again after the displayed time" message using `availableAfter` or `remainingSeconds`.
5. Only after activation returns `allowed: true` may device B turn on the local cloud sync process.

## Login Flow

1. The desktop app generates a random `state` value and opens the system browser.
2. The browser goes to the locale-aware authorize URL:

```text
GET https://example.com/en/desktop/authorize?device_session_id=<client-flow-id>&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=<random-state>
```

3. If the user is not signed in, the website redirects to login and returns to the authorize URL afterward.
4. The website creates a short-lived, one-time desktop auth code.
5. The website redirects back to the desktop app:

```text
gitbookai://auth/callback?code=<one-time-code>&state=<same-random-state>
```

6. The desktop app must verify the returned `state` matches the value it generated.
7. The desktop app exchanges the code for a desktop token.

```http
POST /api/desktop/auth/exchange
Content-Type: application/json

{
  "code": "<one-time-code>",
  "state": "<same-random-state>",
  "deviceId": "device-a",
  "machineCode": "stable-machine-fingerprint",
  "platform": "macos",
  "appVersion": "1.0.0",
  "deviceName": "Studio Mac"
}
```

Successful response:

```json
{
  "token": "desktop-session-token",
  "expiresAt": "2026-05-31T00:00:00.000Z",
  "userId": "user_uuid",
  "desktopSessionId": "session_uuid"
}
```

Store the token only in the operating system credential store, such as macOS Keychain or Windows Credential Manager.

## Entitlement Check

The cloud sync switch must default to off. Before allowing the user to turn it on, call:

```http
GET /api/desktop/entitlement
Authorization: Bearer <desktop-session-token>
```

Example enabled response:

```json
{
  "user": {
    "id": "user_uuid"
  },
  "device": {
    "session_id": "session_uuid",
    "status": "active",
    "platform": "macos"
  },
  "entitlement": {
    "cloud_sync_available": true,
    "support_active": true,
    "support_expires_at": "2026-12-31T23:59:59Z",
    "reason": "active",
    "check_after": "2026-05-06T18:00:00Z"
  }
}
```

Example unsupported response:

```json
{
  "entitlement": {
    "cloud_sync_available": false,
    "support_active": false,
    "support_expires_at": null,
    "reason": "support_required",
    "check_after": "2026-05-06T13:00:00Z"
  }
}
```

If `cloud_sync_available` is `false`, the desktop app must keep the switch off.

## Cloud Sync Activation

Before turning the local cloud sync switch on, activate a server lease:

```http
POST /api/license/cloud-sync/activate
Authorization: Bearer <desktop-session-token>
```

If another device is still actively syncing, the response is:

```json
{
  "allowed": false,
  "reason": "active_on_another_device",
  "activeDeviceId": "device-a"
}
```

If the previous device has released cloud sync but the switch cooldown is still active, the response is:

```json
{
  "allowed": false,
  "reason": "cooldown_waiting",
  "activeDeviceId": "device-a",
  "availableAfter": "2026-05-06T18:00:00Z",
  "remainingSeconds": 7200
}
```

The desktop app should show a clear message such as: "Cloud sync was recently turned off on another device. For data safety, try again after 2 hours 0 minutes." Use the server-provided `availableAfter` or `remainingSeconds`; do not decide availability from the local clock alone.

Successful activation:

```json
{
  "allowed": true,
  "reason": "active",
  "leaseId": "lease_uuid",
  "expiresAt": "2026-05-06T15:02:00Z",
  "activeDeviceId": "device-b"
}
```

## Cloud Sync Heartbeat And Release

After successful activation, the desktop app must keep the server lease alive while local cloud sync is enabled:

```http
POST /api/license/cloud-sync/heartbeat
Authorization: Bearer <desktop-session-token>
```

If heartbeat returns `allowed: false`, the app must stop cloud sync and turn the local switch off. In particular:

- `active_on_another_device`: another device owns the lease now.
- `support_expired`, `support_required`, or similar support errors: the account is no longer entitled to cloud sync.
- `not_authenticated` or `session_revoked`: clear the desktop session and require sign-in again.

When the user manually turns cloud sync off, or disconnects the account from the local app, call:

```http
POST /api/license/cloud-sync/release
Authorization: Bearer <desktop-session-token>
```

This release call tells the server to mark the current cloud sync lease as released and start the device-switch cooldown. If the app is closed unexpectedly and cannot call release, the server will eventually treat the lease as offline after heartbeat expiry and start the cooldown from the server-side expiry time.

## Refresh And Logout

Refresh the desktop token before `expiresAt`:

```http
POST /api/desktop/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<current-desktop-session-token>"
}
```

Successful refresh rotates the token. Replace the locally stored token with the new `token`; the old token is no longer valid.

Logout or local account disconnect:

```http
POST /api/desktop/auth/logout
Authorization: Bearer <desktop-session-token>
```

Successful response:

```json
{
  "revoked": true
}
```

## Error Codes

The desktop app should handle these codes:

- `support_required`: user has not completed development support; keep cloud sync off.
- `support_expired`: development support expired; turn cloud sync off and show renewal UI.
- `active_on_another_device`: another device currently owns cloud sync; keep cloud sync off.
- `cooldown_waiting`: the previous device released cloud sync, but the configured cooldown has not elapsed; keep cloud sync off and show the server-provided retry time.
- `device_replaced`: legacy code for replaced desktop sessions; treat like `session_revoked` if received.
- `session_revoked`: the current desktop session is invalid or revoked; clear local token and require login.
- `account_disabled`: account is disabled; keep cloud sync off and show account support UI.
- `internal_error`: temporary server failure; keep the last local switch state only for a short grace window.

## Desktop App Requirements

- Register the custom URI scheme used by the website callback.
- Generate a high-entropy `state` per login attempt and verify it on callback.
- Store the desktop token in system secure storage.
- Check entitlement when the app starts, when opening settings, before enabling cloud sync, and again according to `check_after`.
- Call the cloud sync activation endpoint before changing the local switch to on.
- Send heartbeat while cloud sync is on.
- Call the release endpoint when the user turns cloud sync off or disconnects the account.
- Show distinct copy for "another device is currently syncing" and "device switch cooldown is still active".
- Automatically turn cloud sync off if entitlement becomes unavailable.
- Do not treat local cache as permanent permission. Local cache is only a short network-failure fallback.

## Server-Side Behavior

- Desktop auth codes are single-use and expire quickly.
- The auth code exchange verifies `state`.
- One user can have multiple active desktop sessions, but only one active cloud sync lease.
- A new device cannot enable cloud sync while another device has an active lease.
- When a device releases cloud sync, or a heartbeat expires and the server marks the lease released, a configurable cooldown starts. The default is 180 minutes.
- Admin pages expose the global cooldown setting and can grant a temporary per-user cooldown override. Overrides bypass only the device-switch cooldown; they do not bypass support, subscription, disabled-account, or session checks.
- Paid development support updates the cloud sync entitlement validity.
- Admin pages expose entitlement, device session, and lease state, and support manual session revocation with audit logging.
