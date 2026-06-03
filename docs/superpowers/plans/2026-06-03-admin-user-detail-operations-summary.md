# Admin User Detail Operations Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clearer operations summary to the existing admin user detail page, with accurate cloud sync usage and login-history metrics.

**Architecture:** Keep the feature inside the existing admin user detail route. Add small pure helpers in `src/app/[locale]/admin/users/[id]/page.tsx`, expand the existing Supabase queries, and render compact summary metrics above the dense detail sections. Update the existing admin page unit tests and locale message files only.

**Tech Stack:** Next.js App Router, React server components, Supabase admin client, next-intl messages, Vitest with Testing Library.

---

### Task 1: Lock The Data Contract With Failing Tests

**Files:**
- Modify: `tests/unit/admin-pages.test.tsx`

- [ ] **Step 1: Add a failing user-detail operations summary test**

Append a new `it(...)` block near the existing admin user detail tests. The test should create:

```ts
const leasesQuery = createAdminListQuery([
  {
    id: "lease-active",
    desktop_session_id: "session-1",
    device_id: "MacBook",
    machine_code_hash: "machinehash123456",
    lease_started_at: "2026-05-28T08:00:00.000Z",
    last_heartbeat_at: "2026-06-03T07:55:00.000Z",
    expires_at: "2026-06-03T08:10:00.000Z",
    revoked_at: null,
    released_at: null,
    cooldown_until: null,
    updated_at: "2026-06-03T07:55:00.000Z",
  },
  {
    id: "lease-expired",
    desktop_session_id: "session-2",
    device_id: "Old PC",
    machine_code_hash: "oldmachine123456",
    lease_started_at: "2026-04-01T08:00:00.000Z",
    last_heartbeat_at: "2026-04-01T08:30:00.000Z",
    expires_at: "2026-04-01T09:00:00.000Z",
    revoked_at: null,
    released_at: null,
    cooldown_until: null,
    updated_at: "2026-04-01T08:30:00.000Z",
  },
]);
const usageSessionsQuery = createAdminListQuery([
  {
    id: "usage-recent-open",
    lease_id: "lease-active",
    desktop_session_id: "session-1",
    device_id: "MacBook",
    machine_code_hash: "machinehash123456",
    started_at: "2026-06-03T07:00:00.000Z",
    last_heartbeat_at: "2026-06-03T07:30:00.000Z",
    ended_at: null,
    end_reason: null,
    heartbeat_count: 5,
  },
  {
    id: "usage-recent-closed",
    lease_id: "lease-active",
    desktop_session_id: "session-1",
    device_id: "MacBook",
    machine_code_hash: "machinehash123456",
    started_at: "2026-05-25T06:00:00.000Z",
    last_heartbeat_at: "2026-05-25T06:50:00.000Z",
    ended_at: "2026-05-25T07:00:00.000Z",
    end_reason: "released",
    heartbeat_count: 4,
  },
  {
    id: "usage-old",
    lease_id: "lease-expired",
    desktop_session_id: "session-2",
    device_id: "Old PC",
    machine_code_hash: "oldmachine123456",
    started_at: "2026-04-01T08:00:00.000Z",
    last_heartbeat_at: "2026-04-01T09:00:00.000Z",
    ended_at: "2026-04-01T10:00:00.000Z",
    end_reason: "released",
    heartbeat_count: 6,
  },
]);
const loginHistoryQuery = createAdminListQuery([
  {
    id: "login-success",
    ip_address: "203.0.113.10",
    user_agent: "Desktop",
    success: true,
    failure_reason: null,
    login_method: "password",
    logged_in_at: "2026-06-02T12:00:00.000Z",
  },
  {
    id: "login-failed",
    ip_address: "203.0.113.11",
    user_agent: "Desktop",
    success: false,
    failure_reason: "invalid_credentials",
    login_method: "password",
    logged_in_at: "2026-06-01T12:00:00.000Z",
  },
  {
    id: "login-old",
    ip_address: "203.0.113.12",
    user_agent: "Desktop",
    success: false,
    failure_reason: "expired_code",
    login_method: "password",
    logged_in_at: "2026-04-01T12:00:00.000Z",
  },
]);
```

Assert these outcomes:

```ts
expect(screen.getByRole("heading", { name: "User operations summary" })).toBeInTheDocument();
expect(screen.getAllByText("Sync active").length).toBeGreaterThan(0);
expect(screen.getByText("Lifetime cloud sync time")).toBeInTheDocument();
expect(screen.getByText("3h 30m")).toBeInTheDocument();
expect(screen.getByText("Last 30 days cloud sync time")).toBeInTheDocument();
expect(screen.getByText("1h 30m")).toBeInTheDocument();
expect(screen.getByText("Desktop last online")).toBeInTheDocument();
expect(screen.getByText("Recent login attempts")).toBeInTheDocument();
expect(screen.getByText("1 success / 1 failed")).toBeInTheDocument();
expect(leasesQuery.select).toHaveBeenCalledWith(expect.stringContaining("lease_started_at"));
expect(usageSessionsQuery.limit).toHaveBeenCalledWith(1000);
expect(loginHistoryQuery.limit).toHaveBeenCalledWith(200);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```zsh
npx vitest run tests/unit/admin-pages.test.tsx -t "user-detail operations summary"
```

Expected: FAIL because the heading and new summary labels do not exist yet, and query limits still use the old values.

---

### Task 2: Implement Minimal Summary Logic And UI

**Files:**
- Modify: `src/app/[locale]/admin/users/[id]/page.tsx`

- [ ] **Step 1: Add small pure helpers**

Add helpers near `usageSeconds`:

```ts
const USER_DETAIL_RECENT_WINDOW_DAYS = 30;
const CLOUD_SYNC_USAGE_SESSION_DETAIL_LIMIT = 1000;
const LOGIN_HISTORY_DETAIL_LIMIT = 200;

function isActiveCloudSyncLease(
  lease: { expires_at?: string | null; released_at?: string | null; revoked_at?: string | null },
  now = new Date(),
) {
  if (lease.revoked_at || lease.released_at || !lease.expires_at) return false;

  const expiresAt = new Date(lease.expires_at).getTime();
  return !Number.isNaN(expiresAt) && expiresAt > now.getTime();
}

function isWithinRecentWindow(value: string | null | undefined, now = new Date(), days = USER_DETAIL_RECENT_WINDOW_DAYS) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  return timestamp >= now.getTime() - days * 24 * 60 * 60 * 1000;
}
```

- [ ] **Step 2: Expand existing query limits and lease columns**

Change the existing user-detail queries:

```ts
.from("cloud_sync_leases")
.select("id,desktop_session_id,device_id,machine_code_hash,lease_started_at,last_heartbeat_at,expires_at,revoked_at,released_at,cooldown_until,updated_at")
...
.from("cloud_sync_usage_sessions")
...
.limit(CLOUD_SYNC_USAGE_SESSION_DETAIL_LIMIT)
...
.from("user_login_history")
...
.limit(LOGIN_HISTORY_DETAIL_LIMIT)
```

- [ ] **Step 3: Compute the summary values**

After converting query results into arrays, compute:

```ts
const now = new Date();
const activeLease = leases.find((lease) => isActiveCloudSyncLease(lease, now));
const totalUsageSeconds = usageSessions.reduce((total, session) => total + usageSeconds(session, now), 0);
const recentUsageSeconds = usageSessions
  .filter((session) => isWithinRecentWindow(session.started_at, now))
  .reduce((total, session) => total + usageSeconds(session, now), 0);
const latestUsageSession = usageSessions[0];
const latestLeaseStartedAt = leases
  .map((lease) => lease.lease_started_at)
  .filter(Boolean)
  .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] ?? null;
const lastCloudSyncStartAt = latestUsageSession?.started_at ?? latestLeaseStartedAt;
const latestDesktopSeenAt = sessions[0]?.last_seen_at ?? null;
const latestSuccessfulLogin = loginHistory.find((entry) => entry.success);
const latestFailedLogin = loginHistory.find((entry) => !entry.success);
const recentLoginSuccesses = loginHistory.filter((entry) => entry.success && isWithinRecentWindow(entry.logged_in_at, now)).length;
const recentLoginFailures = loginHistory.filter((entry) => !entry.success && isWithinRecentWindow(entry.logged_in_at, now)).length;
const usageSessionsMayBeCapped = usageSessions.length >= CLOUD_SYNC_USAGE_SESSION_DETAIL_LIMIT;
```

Keep `latestSuccessfulLoginAt` as `latestSuccessfulLogin?.logged_in_at ?? null`.

- [ ] **Step 4: Render the operations summary card**

Add a full-width `AdminCard` after the initial profile/password grid and before the role/licenses/detail sections:

```tsx
<AdminCard className="mt-6 p-5">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 className="text-base font-semibold text-slate-950">{t("operationsSummaryTitle")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("operationsSummaryDescription")}</p>
    </div>
    <AdminStatusBadge tone={activeLease ? "success" : "neutral"}>
      {activeLease ? t("cloudSyncUsageActive") : t("cloudSyncUsageInactive")}
    </AdminStatusBadge>
  </div>
  <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <DetailRow label={t("operationsSummaryCloudSyncLifetime")} value={formatUsageDuration(totalUsageSeconds)} />
    <DetailRow label={t("operationsSummaryCloudSyncRecent")} value={formatUsageDuration(recentUsageSeconds)} />
    <DetailRow label={t("operationsSummaryLastCloudSyncStart")} value={lastCloudSyncStartAt ? formatAdminDateTime(lastCloudSyncStartAt, locale) : "-"} />
    <DetailRow label={t("operationsSummaryDesktopLastOnline")} value={latestDesktopSeenAt ? formatAdminDateTime(latestDesktopSeenAt, locale) : "-"} />
    <DetailRow label={t("operationsSummaryLatestLogin")} value={latestSuccessfulLogin ? formatAdminDateTime(latestSuccessfulLogin.logged_in_at, locale) : "-"} />
    <DetailRow label={t("operationsSummaryRecentLogins")} value={t("operationsSummaryRecentLoginCounts", { success: String(recentLoginSuccesses), failed: String(recentLoginFailures) })} />
    <DetailRow label={t("operationsSummaryLatestFailure")} value={latestFailedLogin ? `${formatAdminDateTime(latestFailedLogin.logged_in_at, locale)} / ${latestFailedLogin.failure_reason ?? t("loginHistoryFailed")}` : "-"} />
    <DetailRow label={t("operationsSummaryCurrentDevice")} value={activeLease?.device_id ?? "-"} />
  </dl>
  {usageSessionsMayBeCapped ? (
    <p className="mt-3 text-xs text-amber-700">{t("operationsSummaryCappedNotice", { count: String(CLOUD_SYNC_USAGE_SESSION_DETAIL_LIMIT) })}</p>
  ) : null}
</AdminCard>
```

- [ ] **Step 5: Enhance existing detail sections without changing behavior**

In the login history card, add a compact summary `dl` before the table when rows exist. In the cloud sync usage card, add `recentUsageSeconds` and `lastCloudSyncStartAt` by replacing or extending the existing five metric cells. Keep existing tables, forms, revocation actions, and event lists intact.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```zsh
npx vitest run tests/unit/admin-pages.test.tsx -t "user-detail operations summary"
```

Expected: PASS.

---

### Task 3: Add Locale Messages And Full Verification

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh-Hant.json`
- Modify: `messages/ja.json`
- Modify: `messages/ko.json`
- Modify: `tests/unit/admin-pages.test.tsx`

- [ ] **Step 1: Add admin user detail messages**

Add these keys under `admin.users` in all four locale files and the test message object:

```json
"operationsSummaryTitle": "User operations summary",
"operationsSummaryDescription": "Key cloud sync and login signals for this user.",
"operationsSummaryCloudSyncLifetime": "Lifetime cloud sync time",
"operationsSummaryCloudSyncRecent": "Last 30 days cloud sync time",
"operationsSummaryLastCloudSyncStart": "Last cloud sync start",
"operationsSummaryDesktopLastOnline": "Desktop last online",
"operationsSummaryLatestLogin": "Latest successful login",
"operationsSummaryRecentLogins": "Recent login attempts",
"operationsSummaryRecentLoginCounts": "{success} success / {failed} failed",
"operationsSummaryLatestFailure": "Latest failed login",
"operationsSummaryCurrentDevice": "Current cloud sync device",
"operationsSummaryCappedNotice": "Showing up to {count} cloud sync sessions; lifetime time may be capped.",
"cloudSyncUsageRecent": "Last 30 days",
"cloudSyncUsageCapped": "Usage total may be capped"
```

Translate the values for Traditional Chinese, Japanese, and Korean in the same tone as nearby admin messages.

- [ ] **Step 2: Strengthen the existing broad detail-page test**

In the existing `"renders a user operations detail page..."` test:

```ts
expect(screen.getByRole("heading", { name: "User operations summary" })).toBeInTheDocument();
expect(screen.getByText("Lifetime cloud sync time")).toBeInTheDocument();
expect(screen.getByText("Last 30 days cloud sync time")).toBeInTheDocument();
expect(usageSessionsQuery.limit).toHaveBeenCalledWith(1000);
expect(emptyQuery.limit).toHaveBeenCalledWith(200);
```

If `emptyQuery` is shared by several tables, create a dedicated `loginHistoryQuery` so the assertion is specific.

- [ ] **Step 3: Run focused and project tests**

Run:

```zsh
npx tsc --noEmit
npx vitest run tests/unit/admin-pages.test.tsx
npx vitest run
```

Expected: all commands pass.

- [ ] **Step 4: Commit the implementation**

Run:

```zsh
git add 'src/app/[locale]/admin/users/[id]/page.tsx' tests/unit/admin-pages.test.tsx messages/en.json messages/zh-Hant.json messages/ja.json messages/ko.json
git commit -m "feat: add user detail operations summary"
```

Expected: one implementation commit with only the planned files changed.

