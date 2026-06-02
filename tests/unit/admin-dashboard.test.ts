import { describe, expect, it } from "vitest";
import {
  buildAdminDashboardOverview,
  createDashboardInsightRules,
  fillDashboardTrend,
  formatDashboardMetricValue,
  getAdminDashboardPeriod,
  getMetricComparison,
} from "@/lib/admin/dashboard";

const now = new Date("2026-05-26T12:00:00.000Z");

describe("admin dashboard helpers", () => {
  it("parses supported dashboard periods and falls back to 30 days", () => {
    expect(getAdminDashboardPeriod("7d")).toBe(7);
    expect(getAdminDashboardPeriod("30d")).toBe(30);
    expect(getAdminDashboardPeriod("90d")).toBe(90);
    expect(getAdminDashboardPeriod("14d")).toBe(30);
    expect(getAdminDashboardPeriod(undefined)).toBe(30);
  });

  it("fills daily trend points with zeroes across the selected period", () => {
    expect(
      fillDashboardTrend({
        periodDays: 3,
        now,
        rows: [
          { amount: 900, created_at: "2026-05-25T05:00:00.000Z" },
          { amount: 300, created_at: "2026-05-25T10:00:00.000Z" },
        ],
        valueKey: "amount",
      }),
    ).toEqual([
      { date: "2026-05-24", value: 0, count: 0 },
      { date: "2026-05-25", value: 1200, count: 2 },
      { date: "2026-05-26", value: 0, count: 0 },
    ]);
  });

  it("calculates metric comparisons without misleading zero-denominator percentages", () => {
    expect(getMetricComparison(1500, 1000)).toEqual({ delta: 500, percent: 50, state: "changed" });
    expect(getMetricComparison(600, 0)).toEqual({ delta: 600, percent: null, state: "new" });
    expect(getMetricComparison(0, 0)).toEqual({ delta: 0, percent: null, state: "flat" });
  });

  it("formats currency and count metrics for the admin locale", () => {
    expect(formatDashboardMetricValue({ format: "currency", value: 123456 }, "en")).toBe("$1,234.56");
    expect(formatDashboardMetricValue({ format: "number", value: 1234 }, "en")).toBe("1,234");
  });

  it("builds insights for revenue drops, support backlog, webhook errors, and paused checkout", () => {
    const insights = createDashboardInsightRules({
      cloudSyncConflictEvents: 1,
      currentRevenue: 500,
      failedReleaseCount: 0,
      loginFailureCount: 1,
      missingReleaseAssetCount: 0,
      openFeedbackCount: 8,
      paymentPaused: true,
      previousRevenue: 2000,
      webhookErrorCount: 3,
    });

    expect(insights.map((insight) => insight.id)).toEqual([
      "payment-paused",
      "revenue-drop",
      "feedback-backlog",
      "webhook-errors",
    ]);
    expect(insights[0]).toMatchObject({ severity: "critical", href: "/admin/contribution-pricing" });
  });

  it("builds an overview from existing admin data rows", () => {
    const overview = buildAdminDashboardOverview({
      now,
      periodDays: 7,
      rows: {
        certificates: [{ issued_at: "2026-05-25T08:00:00.000Z", status: "active", user_id: "real-user" }],
        cloudSyncLeases: [
          {
            desktop_session_id: "desktop-real",
            device_id: "pc-real",
            expires_at: "2026-05-26T13:00:00.000Z",
            id: "lease-active",
            lease_started_at: "2026-05-26T11:30:00.000Z",
            released_at: null,
            revoked_at: null,
            user_id: "real-user",
          },
          {
            desktop_session_id: "desktop-entitled",
            device_id: "pc-entitled",
            expires_at: "2026-05-26T13:00:00.000Z",
            id: "lease-released",
            lease_started_at: "2026-05-26T10:30:00.000Z",
            released_at: "2026-05-26T10:45:00.000Z",
            revoked_at: "2026-05-26T10:45:00.000Z",
            user_id: "entitled-user",
          },
        ],
        cloudSyncUsageEvents: [
          { event_type: "activate_success", occurred_at: "2026-05-25T08:00:00.000Z", user_id: "real-user" },
          { event_type: "activate_conflict", occurred_at: "2026-05-25T09:00:00.000Z", user_id: "real-user" },
          { event_type: "cooldown_waiting", occurred_at: "2026-05-25T10:00:00.000Z", user_id: "real-user" },
        ],
        cloudSyncUsageSessions: [
          {
            device_id: "pc-real",
            ended_at: "2026-05-25T09:00:00.000Z",
            end_reason: "released",
            id: "usage-closed",
            last_heartbeat_at: "2026-05-25T08:50:00.000Z",
            started_at: "2026-05-25T08:00:00.000Z",
            user_id: "real-user",
          },
          {
            device_id: "pc-real",
            ended_at: null,
            end_reason: null,
            id: "usage-open",
            last_heartbeat_at: "2026-05-26T11:45:00.000Z",
            started_at: "2026-05-26T11:30:00.000Z",
            user_id: "real-user",
          },
          {
            device_id: "pc-old",
            ended_at: "2026-04-01T09:00:00.000Z",
            end_reason: "released",
            id: "usage-old",
            last_heartbeat_at: "2026-04-01T08:55:00.000Z",
            started_at: "2026-04-01T08:00:00.000Z",
            user_id: "real-user",
          },
        ],
        desktopSessions: [
          { id: "desktop-real", last_seen_at: "2026-05-26T11:50:00.000Z", platform: "windows", user_id: "real-user" },
          { id: "desktop-old", last_seen_at: "2026-05-01T11:50:00.000Z", platform: "macos", user_id: "real-user" },
        ],
        donations: [
          { amount: 1000, created_at: "2026-05-25T08:00:00.000Z", paid_at: "2026-05-25T08:30:00.000Z", status: "paid" },
          { amount: 2500, created_at: "2026-05-17T08:00:00.000Z", paid_at: "2026-05-17T08:30:00.000Z", status: "paid" },
        ],
        licenseEntitlements: [
          { feature_code: "cloud_sync", status: "active", user_id: "real-user", valid_until: "2026-06-30T00:00:00.000Z" },
          { feature_code: "cloud_sync", status: "active", user_id: "entitled-user", valid_until: "2026-06-30T00:00:00.000Z" },
        ],
        loginHistory: [
          { logged_in_at: "2026-05-25T08:00:00.000Z", success: true },
          { logged_in_at: "2026-05-25T09:00:00.000Z", success: false },
        ],
        operationalSettings: [{ key: "payment_checkout", value: { is_paused: false } }],
        profiles: [
          { account_status: "active", admin_role: "user", created_at: "2026-05-25T08:00:00.000Z", email: "real@example.com", id: "real-user", is_admin: false },
          { account_status: "active", admin_role: "user", created_at: "2026-05-24T08:00:00.000Z", email: "entitled@example.com", id: "entitled-user", is_admin: false },
          { account_status: "active", admin_role: "operator", created_at: "2026-04-01T08:00:00.000Z", email: "operator@example.com", id: "operator-user", is_admin: false },
          { account_status: "archived_deleted", admin_role: "user", created_at: "2026-04-01T08:00:00.000Z", email: "archived@example.com", id: "archived-user", is_admin: false },
          { account_status: "active", admin_role: "user", created_at: "2026-05-25T08:00:00.000Z", email: "codex-smoke@example.com", id: "test-user", is_admin: false },
        ],
        releases: [
          {
            is_published: true,
            macos_arm64_primary_url: "https://example.com/m.dmg",
            macos_x64_primary_url: null,
            release_status: "ready",
            windows_primary_url: "https://example.com/w.exe",
          },
        ],
        supportFeedback: [{ created_at: "2026-05-25T08:00:00.000Z", status: "open", updated_at: "2026-05-25T09:00:00.000Z" }],
        trialCodeRedemptions: [
          { redeemed_at: "2026-05-25T08:00:00.000Z", trial_valid_until: "2026-06-25T08:00:00.000Z", user_id: "real-user" },
          { redeemed_at: "2026-05-25T08:00:00.000Z", trial_valid_until: "2026-06-25T08:00:00.000Z", user_id: "test-user" },
        ],
        userLoginHistory: [{ logged_in_at: "2026-05-25T08:00:00.000Z", success: false }],
        webhookLogs: [{ created_at: "2026-05-25T08:00:00.000Z", status: "error" }],
      },
    });

    expect(overview.metrics.totalUsers.value).toBe(2);
    expect(overview.metrics.revenue.value).toBe(0);
    expect(overview.metrics.revenue.comparison).toMatchObject({ delta: 0, state: "flat" });
    expect(overview.metrics.newUsers.value).toBe(0);
    expect(overview.metrics.certificatesIssued.value).toBe(1);
    expect(overview.metrics.activeTrials.value).toBe(1);
    expect(overview.health.webhookErrors.count).toBe(1);
    expect(overview.health.releaseHealth.count).toBe(1);
    expect(overview.attentionItems.map((item) => item.id)).toContain("open-feedback");
    expect(overview.revenueTrend).toHaveLength(7);
    expect(overview.cloudSync.metrics.activeUsers).toBe(1);
    expect(overview.cloudSync.metrics.entitledUsers).toBe(2);
    expect(overview.cloudSync.metrics.enabledUsersInWindow).toBe(1);
    expect(overview.cloudSync.metrics.sessionCount).toBe(2);
    expect(overview.cloudSync.metrics.totalDurationSeconds).toBe(4500);
    expect(overview.cloudSync.metrics.averageSessionDurationSeconds).toBe(2250);
    expect(overview.cloudSync.users[0]).toMatchObject({
      active: true,
      conflictCount: 1,
      cooldownCount: 1,
      currentDeviceId: "pc-real",
      currentPlatform: "windows",
      email: "real@example.com",
      lastCloudSyncStartedAt: "2026-05-26T11:30:00.000Z",
      lastDesktopSeenAt: "2026-05-26T11:50:00.000Z",
      latestSessionDurationSeconds: 900,
      sessionCount: 2,
      totalDurationSeconds: 4500,
      userId: "real-user",
    });
    expect(overview.cloudSync.users.find((user) => user.userId === "entitled-user")).toMatchObject({
      active: false,
      sessionCount: 0,
    });
  });

  it("supports all-time cloud sync monitoring without applying a usage window", () => {
    const overview = buildAdminDashboardOverview({
      cloudSyncWindow: "all",
      now,
      periodDays: 7,
      rows: {
        certificates: [],
        cloudSyncLeases: [],
        cloudSyncUsageEvents: [],
        cloudSyncUsageSessions: [
          {
            device_id: "pc-real",
            ended_at: "2026-04-01T09:00:00.000Z",
            end_reason: "released",
            id: "usage-old",
            last_heartbeat_at: "2026-04-01T08:55:00.000Z",
            started_at: "2026-04-01T08:00:00.000Z",
            user_id: "real-user",
          },
        ],
        desktopSessions: [],
        donations: [],
        licenseEntitlements: [],
        loginHistory: [],
        operationalSettings: [],
        profiles: [
          { account_status: "active", admin_role: "user", created_at: "2026-03-01T08:00:00.000Z", email: "real@example.com", id: "real-user", is_admin: false },
        ],
        releases: [],
        supportFeedback: [],
        trialCodeRedemptions: [],
        userLoginHistory: [],
        webhookLogs: [],
      },
    });

    expect(overview.cloudSync.window).toBe("all");
    expect(overview.cloudSync.metrics.sessionCount).toBe(1);
    expect(overview.cloudSync.metrics.totalDurationSeconds).toBe(3600);
  });

  it("includes operator accounts in cloud sync monitoring while excluding them from user totals", () => {
    const overview = buildAdminDashboardOverview({
      now,
      periodDays: 7,
      rows: {
        certificates: [],
        cloudSyncLeases: [
          {
            desktop_session_id: "operator-desktop",
            device_id: "operator-pc",
            expires_at: "2026-05-26T13:00:00.000Z",
            id: "operator-active-lease",
            lease_started_at: "2026-05-26T11:30:00.000Z",
            released_at: null,
            revoked_at: null,
            user_id: "operator-user",
          },
        ],
        cloudSyncUsageEvents: [],
        cloudSyncUsageSessions: [],
        desktopSessions: [
          { id: "operator-desktop", last_seen_at: "2026-05-26T11:45:00.000Z", platform: "windows", user_id: "operator-user" },
        ],
        donations: [],
        licenseEntitlements: [
          { feature_code: "cloud_sync", status: "active", user_id: "operator-user", valid_until: "2026-06-30T00:00:00.000Z" },
        ],
        loginHistory: [],
        operationalSettings: [],
        profiles: [
          { account_status: "active", admin_role: "operator", created_at: "2026-05-01T08:00:00.000Z", email: "operator@example.com", id: "operator-user", is_admin: false },
        ],
        releases: [],
        supportFeedback: [],
        trialCodeRedemptions: [],
        userLoginHistory: [],
        webhookLogs: [],
      },
    });

    expect(overview.metrics.totalUsers.value).toBe(0);
    expect(overview.cloudSync.metrics.activeUsers).toBe(1);
    expect(overview.cloudSync.metrics.entitledUsers).toBe(1);
    expect(overview.cloudSync.users[0]).toMatchObject({
      active: true,
      currentDeviceId: "operator-pc",
      currentPlatform: "windows",
      email: "operator@example.com",
      userId: "operator-user",
    });
  });
});
