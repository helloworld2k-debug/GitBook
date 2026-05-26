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
        certificates: [{ issued_at: "2026-05-25T08:00:00.000Z", status: "active" }],
        cloudSyncUsageEvents: [
          { event_type: "activate_success", occurred_at: "2026-05-25T08:00:00.000Z" },
          { event_type: "activate_conflict", occurred_at: "2026-05-25T09:00:00.000Z" },
        ],
        cloudSyncUsageSessions: [{ started_at: "2026-05-25T08:00:00.000Z" }],
        donations: [
          { amount: 1000, created_at: "2026-05-25T08:00:00.000Z", paid_at: "2026-05-25T08:30:00.000Z", status: "paid" },
          { amount: 2500, created_at: "2026-05-17T08:00:00.000Z", paid_at: "2026-05-17T08:30:00.000Z", status: "paid" },
        ],
        licenseEntitlements: [{ status: "active", valid_until: "2026-06-30T00:00:00.000Z" }],
        loginHistory: [
          { logged_in_at: "2026-05-25T08:00:00.000Z", success: true },
          { logged_in_at: "2026-05-25T09:00:00.000Z", success: false },
        ],
        operationalSettings: [{ key: "payment_checkout", value: { is_paused: false } }],
        profiles: [
          { account_status: "active", created_at: "2026-05-25T08:00:00.000Z" },
          { account_status: "active", created_at: "2026-04-01T08:00:00.000Z" },
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
        trialCodeRedemptions: [{ redeemed_at: "2026-05-25T08:00:00.000Z", trial_valid_until: "2026-06-25T08:00:00.000Z" }],
        trialCodes: [{ deleted_at: null, ends_at: null, is_active: true, starts_at: null }],
        userLoginHistory: [{ logged_in_at: "2026-05-25T08:00:00.000Z", success: false }],
        webhookLogs: [{ created_at: "2026-05-25T08:00:00.000Z", status: "error" }],
      },
    });

    expect(overview.metrics.totalUsers.value).toBe(2);
    expect(overview.metrics.revenue.value).toBe(1000);
    expect(overview.metrics.revenue.comparison).toMatchObject({ delta: -1500, percent: -60 });
    expect(overview.metrics.newUsers.value).toBe(1);
    expect(overview.health.webhookErrors.count).toBe(1);
    expect(overview.health.releaseHealth.count).toBe(1);
    expect(overview.attentionItems.map((item) => item.id)).toContain("open-feedback");
    expect(overview.revenueTrend).toHaveLength(7);
  });
});
