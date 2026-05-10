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
  "desktopSessionId": "session_uuid",
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "name": "User Display Name"
  }
}
```

Store the token only in the operating system credential store, such as macOS Keychain or Windows Credential Manager. Use `user.name` as the primary display name, fall back to `user.email`, and only fall back to `userId` if both are empty. Do not display a raw UUID as the normal username when `name` or `email` is available.

### Automatic Browser Return

The desktop app should not require the user to copy and paste the callback URL during normal login. Manual paste should remain available only as a fallback.

Required behavior:

1. The user clicks "Web sign in / Register" in the desktop app.
2. The desktop app registers the `gitbookai://` custom URI scheme.
3. The desktop app opens the authorize URL in the system browser.
4. If the browser already has a valid website session, the website should immediately create a desktop auth code and show/trigger the `gitbookai://auth/callback?...` return page. It should not ask the user to sign in again.
5. If the browser is not signed in, the website redirects to login, then returns to the authorize URL after successful login.
6. The browser opens `gitbookai://auth/callback?...`; the operating system returns that URL to the desktop app.
7. The desktop app verifies `state`, exchanges `code`, saves the desktop session, and updates the UI to show the signed-in user and cloud sync status.

Platform notes:

- **Windows:** register `gitbookai://` under the current user's URL protocol registry key. The command must pass the full callback URL to the running app or to a small helper process that writes the callback to the main app.
- **macOS:** declare `gitbookai` in `CFBundleURLTypes`. A helper app or the main `.app` must handle the `kAEGetURL` Apple Event and read the URL from the direct object, then deliver it to the running desktop app.
- **Packaged apps:** register the scheme in the packaged app's metadata (`Info.plist` on macOS, registry setup on Windows installer or first launch).
- **Source/development runs:** a small helper app/process is acceptable, as long as it receives the callback and hands it to the running Python app.

The desktop app must accept both raw and URL-encoded callback strings:

```text
gitbookai://auth/callback?code=abc&state=xyz
gitbookai%3A%2F%2Fauth%2Fcallback%3Fcode%3Dabc%26state%3Dxyz
```

If automatic return fails, show a fallback button such as "Paste callback link". The user must paste the final `gitbookai://auth/callback?...` URL, not the HTTPS authorize page URL.

### Remember Login For 30 Days

The login screen should include a checked-by-default option similar to "Keep me signed in for 30 days".

- When checked, keep the local desktop session for up to 30 days or until the server `expiresAt`, whichever expires first.
- When unchecked, store only a short local session suitable for the current work session.
- Always honor server revocation and refresh behavior. A local "remember me" flag must not override `session_revoked`, `device_replaced`, account disablement, or server token expiry.
- The client should show a clear signed-in state after login, including the display name/email and cloud sync status.

## Developer Configuration

Software developers only need the public website API endpoint, the fixed cloud sync feature code, and the user's desktop session token. Do not give desktop developers Supabase service role keys, database connection strings, license code hashes, plaintext license code exports, or encryption secrets.

Recommended configuration:

```env
LICENSE_STATUS_URL=https://example.com/api/license/status
LICENSE_FEATURE=cloud_sync
```

Runtime credential:

```text
DESKTOP_SESSION_TOKEN=<desktop-session-token returned by /api/desktop/auth/exchange>
```

The desktop session token is user-specific and must be stored in the operating system credential store. Treat it like a password-equivalent bearer token.

## License Validity Status

To read the user's cloud sync validity time, call:

```http
GET /api/license/status?feature=cloud_sync
Authorization: Bearer <desktop-session-token>
```

Successful paid entitlement response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": true,
  "reason": "active",
  "source": "paid",
  "validUntil": "2026-05-31T00:00:00.000Z",
  "remainingDays": 23,
  "activeDeviceId": "device-a"
}
```

Successful trial entitlement response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": true,
  "reason": "trial_active",
  "source": "trial",
  "validUntil": "2026-05-15T00:00:00.000Z",
  "remainingDays": 7,
  "activeDeviceId": "device-a"
}
```

Expired or unavailable response:

```json
{
  "authenticated": true,
  "feature": "cloud_sync",
  "allowed": false,
  "reason": "expired",
  "validUntil": "2026-04-30T00:00:00.000Z",
  "remainingDays": 0,
  "activeDeviceId": "device-a"
}
```

Desktop apps should use these fields:

- `authenticated`: whether the desktop session token is valid.
- `allowed`: whether cloud sync may currently be used.
- `validUntil`: cloud sync validity deadline in ISO 8601 UTC format, or `null` if no entitlement exists.
- `remainingDays`: server-calculated remaining days.
- `reason`: status reason, such as `active`, `trial_active`, `expired`, `revoked`, `trial_code_required`, or `trial_expired`.
- `source`: entitlement source when allowed, either `paid` or `trial`.
- `activeDeviceId`: the current desktop device id known by the server.

Do not calculate entitlement validity from the local computer clock. Display `validUntil` and `remainingDays` from the server response, and re-check status when the app starts, when opening settings, before enabling cloud sync, and after payment or license redemption flows.

Recommended desktop display copy:

- `allowed: true`, `validUntil` present: `Cloud sync: valid until 2026-05-31 (23 days remaining)`.
- `allowed: true`, `validUntil: null`: `Cloud sync: active`.
- `reason: trial_code_required` or `support_required`: `Cloud sync: not activated`.
- `reason: expired` or `trial_expired`: `Cloud sync: expired`.
- `reason: revoked`: `Cloud sync: revoked`.
- `reason: not_authenticated` or `session_revoked`: clear the desktop session and show sign-in again.

The account header or settings page should show this status near the signed-in user identity. This lets the user distinguish "signed in successfully" from "cloud sync is available".

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

## Acceptance Tests For Desktop Vendors

The updated desktop software should pass these tests before release:

1. **macOS automatic return:** click web sign-in, complete browser login, approve opening the desktop app/helper, and verify the desktop app logs in without manual paste.
2. **Windows automatic return:** click web sign-in, complete browser login, and verify the registered `gitbookai://` protocol returns to the desktop app without manual paste.
3. **Existing browser session:** sign in to the website in the default browser first, then start desktop web sign-in. The browser should not ask for credentials again; it should authorize and return to the desktop app.
4. **State protection:** start one login attempt, then paste or receive a callback with a different `state`. The app must reject it and ask the user to retry login.
5. **Encoded callback:** verify the app accepts both raw `gitbookai://auth/callback?...` and URL-encoded callback text in the fallback paste flow.
6. **User display:** after login, the desktop app should show `user.name` or `user.email`, not the raw `userId`, when those fields are present.
7. **30-day login:** with "keep me signed in for 30 days" checked, restart the app and confirm it remains signed in while the server session is valid.
8. **No remember login:** with the option unchecked, verify the app does not create a long-lived local login.
9. **Cloud sync status:** after login, call `GET /api/license/status?feature=cloud_sync` and display `validUntil` / `remainingDays` or a clear unavailable reason such as `trial_code_required`.
10. **Cloud sync activation:** sign in on device B while device A owns cloud sync. Device B login must succeed, but cloud sync activation must fail with `active_on_another_device` or `cooldown_waiting` as appropriate.

## Desktop App Requirements

- Register the custom URI scheme used by the website callback.
- Make browser login return automatically to the app on Windows and macOS. Do not require manual callback paste in the normal path.
- Generate a high-entropy `state` per login attempt and verify it on callback.
- Accept both raw and URL-encoded `gitbookai://auth/callback?...` callback strings.
- Include a checked-by-default "keep me signed in for 30 days" option on the login screen.
- After sign-in, show the user's display name or email. Do not show a raw UUID unless the server did not provide name or email.
- Store the desktop token in system secure storage.
- Check entitlement when the app starts, when opening settings, before enabling cloud sync, and again according to `check_after`.
- Display cloud sync validity using server-provided `validUntil` and `remainingDays`.
- Call the cloud sync activation endpoint before changing the local switch to on.
- Send heartbeat while cloud sync is on.
- Call the release endpoint when the user turns cloud sync off or disconnects the account.
- Show distinct copy for "another device is currently syncing" and "device switch cooldown is still active".
- Automatically turn cloud sync off if entitlement becomes unavailable.
- Do not treat local cache as permanent permission. Local cache is only a short network-failure fallback.

## Server-Side Behavior

- Desktop auth codes are single-use and expire quickly.
- The auth code exchange verifies `state`.
- The desktop auth exchange response should include `user.id`, `user.email`, and `user.name` when available so the desktop app can display a friendly signed-in user.
- If the browser already has a valid website session, `/[locale]/desktop/authorize` should create the desktop auth code directly and return `gitbookai://auth/callback?...`; it should not force the user through login again.
- One user can have multiple active desktop sessions, but only one active cloud sync lease.
- A new device cannot enable cloud sync while another device has an active lease.
- When a device releases cloud sync, or a heartbeat expires and the server marks the lease released, a configurable cooldown starts. The default is 180 minutes.
- Admin pages expose the global cooldown setting and can grant a temporary per-user cooldown override. Overrides bypass only the device-switch cooldown; they do not bypass support, subscription, disabled-account, or session checks.
- Paid development support updates the cloud sync entitlement validity.
- Admin pages expose entitlement, device session, and lease state, and support manual session revocation with audit logging.
