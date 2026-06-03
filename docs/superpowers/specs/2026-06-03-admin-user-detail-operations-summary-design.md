# Admin User Detail Operations Summary Design

## Summary

Upgrade the existing admin user detail page so each user has a clearer operational view for cloud sync usage and login activity. The page should help operators quickly answer: is this user using cloud sync now, how much have they used it, when did they last log in, and what recent activity led to that state.

This change does not add a new route, database table, export workflow, or cloud sync business logic. It refines the existing `/{locale}/admin/users/{id}` page and uses data the page already reads from `profiles`, `desktop_sessions`, `user_login_history`, `cloud_sync_leases`, `cloud_sync_usage_sessions`, and `cloud_sync_usage_events`.

## User Experience

Add a top-level "user operations summary" area near the top of the user detail page, before the dense operational history sections. It should keep the existing admin style and use compact metric cards rather than a marketing layout.

The summary should show these fields:

- Cloud sync status: enabled only when the user has at least one active lease.
- Lifetime cloud sync enabled time.
- Last 30 days cloud sync enabled time.
- Last cloud sync start time.
- Desktop last online time.
- Latest successful account login.
- Login attempts in the last 30 days, split into successful and failed counts.

Keep the existing detailed sections, but make them easier to connect to the summary:

- The login history section remains a recent attempts table and gains a small summary row for latest success, latest failure, and 30-day success/failure totals.
- The cloud sync usage section remains a sessions/events detail area and gains clearer lifetime, 30-day, latest session, and current active lease context.
- User name/email links, support data, license data, certificates, trial codes, and existing admin actions remain unchanged.

## Data Definitions

Use Beijing time formatting for all timestamps through the existing admin formatting helpers.

Cloud sync active status:

- Active lease means `revoked_at is null`, `released_at is null`, and `expires_at > now`.
- Expired, released, or revoked leases do not count as enabled.

Cloud sync usage duration:

- For each `cloud_sync_usage_sessions` row, duration is `ended_at ?? last_heartbeat_at ?? now` minus `started_at`.
- Ignore negative durations by clamping them to `0`.
- Lifetime total is the sum of all fetched cloud sync usage sessions for this user.
- Last 30 days total is the sum of sessions whose `started_at` is within the last 30 days.
- Last cloud sync start is the latest `cloud_sync_usage_sessions.started_at`; if no session exists, fall back to the latest `cloud_sync_leases.lease_started_at`.

Login activity:

- Latest successful login is the newest `user_login_history` row where `success = true`.
- Latest failed login is the newest `user_login_history` row where `success = false`.
- Last 30 days login counts use `logged_in_at >= now - 30 days`.
- Desktop last online remains separate from account login and uses the newest `desktop_sessions.last_seen_at`.

Query scope:

- Fetch enough rows for correct user-level summaries, not only the rows displayed in tables.
- For cloud sync usage sessions, fetch up to 1000 recent/all-time rows ordered by `started_at desc`; display only the recent subset currently needed by the UI.
- For login history, fetch up to 200 rows ordered by `logged_in_at desc`; display the existing recent table size while using the fetched rows for summary counts.
- If the cloud sync usage session cap is reached, show a subtle admin-only note that lifetime totals may be capped.

## Implementation Boundaries

Do not create `/admin/cloud-sync` or add a navigation item. This is a user detail page enhancement only.

Do not modify:

- Public pages.
- Download buttons.
- Payment/support/certificate business logic.
- Cloud sync lease acquisition or desktop client behavior.
- Database schema or migrations.
- CSV/export behavior.

Prefer small helper functions inside the user detail page or a nearby admin utility if the page becomes difficult to read. Any helper should have explicit inputs and no hidden Supabase dependency.

## Testing Plan

Add or update page tests around `/{locale}/admin/users/{id}`:

- The operations summary renders cloud sync status, lifetime duration, 30-day duration, desktop last online, latest successful login, and 30-day login counts.
- Active cloud sync status excludes expired, released, and revoked leases.
- Open cloud sync sessions use `last_heartbeat_at` or current time for duration; closed sessions use `ended_at`.
- The 30-day cloud sync total does not include older sessions.
- Latest cloud sync start prefers usage sessions and falls back to lease start only when sessions are absent.
- Login summary counts recent successful and failed attempts separately.
- Existing login history and cloud sync usage detail rows still render.
- Existing Beijing time formatting remains visible in admin timestamps.

Run these verification commands before landing implementation:

```zsh
npx tsc --noEmit
npx vitest run tests/unit/admin-pages.test.tsx
npx vitest run
```

## Assumptions

- "累计启用时间" means the sum of cloud sync usage session durations, not the age of the user's entitlement.
- "最近 30 天" is measured from the server-side render time.
- Account login history and desktop last online are intentionally shown as separate signals.
- The current data volume is small enough for capped user-detail queries; if a user reaches the cap, the UI should disclose that the lifetime number may be capped.
- This enhancement is for admin operators only and does not expose new data to public users.
