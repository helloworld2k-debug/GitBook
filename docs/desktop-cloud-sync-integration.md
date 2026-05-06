# Desktop Cloud Sync Entitlement Integration

This document is for desktop software developers integrating the cloud sync switch with the website account and development support system.

The website does not store or transport cloud sync data. It only authenticates the user, manages development support entitlements, and tells the desktop app whether the cloud sync switch may be enabled.

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
- `device_replaced`: another desktop login replaced this session; clear local token and require login.
- `session_revoked`: the current desktop session is invalid or revoked; clear local token and require login.
- `account_disabled`: account is disabled; keep cloud sync off and show account support UI.
- `internal_error`: temporary server failure; keep the last local switch state only for a short grace window.

## Desktop App Requirements

- Register the custom URI scheme used by the website callback.
- Generate a high-entropy `state` per login attempt and verify it on callback.
- Store the desktop token in system secure storage.
- Check entitlement when the app starts, when opening settings, before enabling cloud sync, and again according to `check_after`.
- Automatically turn cloud sync off if entitlement becomes unavailable.
- Do not treat local cache as permanent permission. Local cache is only a short network-failure fallback.

## Server-Side Behavior

- Desktop auth codes are single-use and expire quickly.
- The auth code exchange verifies `state`.
- One user can have only one active desktop session; a new login revokes older desktop sessions and cloud sync leases.
- Paid development support updates the cloud sync entitlement validity.
- Admin pages expose entitlement, device session, and lease state, and support manual session revocation with audit logging.
