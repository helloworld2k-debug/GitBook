import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type AdminDashboardPeriod = 7 | 30 | 90;
export type AdminDashboardMetricFormat = "currency" | "number" | "percent";
export type AdminDashboardSeverity = "critical" | "info" | "success" | "warning";

export type AdminDashboardComparison = {
  delta: number;
  percent: number | null;
  state: "changed" | "flat" | "new";
};

export type AdminDashboardMetric = {
  comparison?: AdminDashboardComparison;
  format: AdminDashboardMetricFormat;
  href: string;
  id: string;
  value: number;
};

export type AdminDashboardTrendPoint = {
  count: number;
  date: string;
  value: number;
};

export type AdminDashboardInsight = {
  descriptionKey: string;
  href: string;
  id: string;
  severity: AdminDashboardSeverity;
  titleKey: string;
};

export type AdminDashboardAttentionItem = {
  count: number;
  descriptionKey: string;
  href: string;
  id: string;
  severity: AdminDashboardSeverity;
  titleKey: string;
};

export type AdminDashboardHealthItem = {
  count: number;
  href: string;
  id: string;
  severity: AdminDashboardSeverity;
};

export type AdminDashboardOverview = {
  attentionItems: AdminDashboardAttentionItem[];
  health: {
    cloudSyncConflicts: AdminDashboardHealthItem;
    loginFailures: AdminDashboardHealthItem;
    paymentCheckout: AdminDashboardHealthItem;
    releaseHealth: AdminDashboardHealthItem;
    webhookErrors: AdminDashboardHealthItem;
  };
  insights: AdminDashboardInsight[];
  metrics: {
    activeEntitlements: AdminDashboardMetric;
    activeTrials: AdminDashboardMetric;
    certificatesIssued: AdminDashboardMetric;
    newUsers: AdminDashboardMetric;
    openFeedback: AdminDashboardMetric;
    paidSupportCount: AdminDashboardMetric;
    revenue: AdminDashboardMetric;
    totalUsers: AdminDashboardMetric;
  };
  periodDays: AdminDashboardPeriod;
  revenueTrend: AdminDashboardTrendPoint[];
  userTrend: AdminDashboardTrendPoint[];
};

type DashboardRows = {
  certificates: Array<{ issued_at: string; status: string }>;
  cloudSyncUsageEvents: Array<{ event_type: string; occurred_at: string }>;
  cloudSyncUsageSessions: Array<{ started_at: string }>;
  donations: Array<{ amount: number; created_at: string; paid_at: string | null; status: string }>;
  licenseEntitlements: Array<{ status: string; valid_until: string }>;
  loginHistory: Array<{ logged_in_at: string | null; success: boolean }>;
  operationalSettings: Array<{ key: string; value: Json }>;
  profiles: Array<{ account_status: string; created_at: string }>;
  releases: Array<{
    is_published: boolean;
    macos_arm64_primary_url: string | null;
    macos_x64_primary_url: string | null;
    release_status: string | null;
    windows_primary_url: string | null;
  }>;
  supportFeedback: Array<{ created_at: string; status: string; updated_at: string }>;
  trialCodeRedemptions: Array<{ redeemed_at: string; trial_valid_until: string }>;
  trialCodes: Array<{ deleted_at: string | null; ends_at: string | null; is_active: boolean; starts_at: string | null }>;
  userLoginHistory: Array<{ logged_in_at: string | null; success: boolean }>;
  webhookLogs: Array<{ created_at: string; status: string }>;
};

const allowedPeriods: AdminDashboardPeriod[] = [7, 30, 90];

export function getAdminDashboardPeriod(value: string | string[] | null | undefined): AdminDashboardPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? "").replace(/d$/, "");
  const parsed = Number(normalized);

  return allowedPeriods.includes(parsed as AdminDashboardPeriod) ? (parsed as AdminDashboardPeriod) : 30;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function periodStart(now: Date, periodDays: number) {
  return addUtcDays(startOfUtcDay(now), -(periodDays - 1));
}

function previousPeriodStart(now: Date, periodDays: number) {
  return addUtcDays(periodStart(now, periodDays), -periodDays);
}

function inRange(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function fillDashboardTrend({
  now,
  periodDays,
  rows,
  valueKey,
}: {
  now: Date;
  periodDays: AdminDashboardPeriod;
  rows: Array<Record<string, number | string | null>>;
  valueKey?: string;
}): AdminDashboardTrendPoint[] {
  const start = periodStart(now, periodDays);
  const points = new Map<string, AdminDashboardTrendPoint>();

  for (let index = 0; index < periodDays; index += 1) {
    const key = dateKey(addUtcDays(start, index));
    points.set(key, { count: 0, date: key, value: 0 });
  }

  for (const row of rows) {
    const rawDate = row.created_at ?? row.paid_at ?? row.issued_at ?? row.redeemed_at ?? row.logged_in_at ?? row.occurred_at ?? row.started_at;
    if (typeof rawDate !== "string") continue;

    const key = dateKey(rawDate);
    const point = points.get(key);
    if (!point) continue;

    point.count += 1;
    point.value += valueKey && typeof row[valueKey] === "number" ? row[valueKey] : 1;
  }

  return Array.from(points.values());
}

export function getMetricComparison(current: number, previous: number): AdminDashboardComparison {
  const delta = current - previous;
  if (previous === 0) {
    return { delta, percent: null, state: current === 0 ? "flat" : "new" };
  }

  return {
    delta,
    percent: Math.round((delta / previous) * 1000) / 10,
    state: delta === 0 ? "flat" : "changed",
  };
}

export function formatDashboardMetricValue(
  metric: Pick<AdminDashboardMetric, "format" | "value">,
  locale: string,
) {
  if (metric.format === "currency") {
    return new Intl.NumberFormat(locale, {
      currency: "USD",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(metric.value / 100);
  }

  if (metric.format === "percent") {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
      style: "percent",
    }).format(metric.value / 100);
  }

  return new Intl.NumberFormat(locale).format(metric.value);
}

export function createDashboardInsightRules({
  cloudSyncConflictEvents,
  currentRevenue,
  failedReleaseCount,
  loginFailureCount,
  missingReleaseAssetCount,
  openFeedbackCount,
  paymentPaused,
  previousRevenue,
  webhookErrorCount,
}: {
  cloudSyncConflictEvents: number;
  currentRevenue: number;
  failedReleaseCount: number;
  loginFailureCount: number;
  missingReleaseAssetCount: number;
  openFeedbackCount: number;
  paymentPaused: boolean;
  previousRevenue: number;
  webhookErrorCount: number;
}): AdminDashboardInsight[] {
  const insights: AdminDashboardInsight[] = [];

  if (paymentPaused) {
    insights.push({
      descriptionKey: "insights.paymentPausedDescription",
      href: "/admin/contribution-pricing",
      id: "payment-paused",
      severity: "critical",
      titleKey: "insights.paymentPausedTitle",
    });
  }

  if (previousRevenue > 0 && currentRevenue < previousRevenue * 0.75) {
    insights.push({
      descriptionKey: "insights.revenueDropDescription",
      href: "/admin/donations",
      id: "revenue-drop",
      severity: "warning",
      titleKey: "insights.revenueDropTitle",
    });
  }

  if (openFeedbackCount >= 5) {
    insights.push({
      descriptionKey: "insights.feedbackBacklogDescription",
      href: "/admin/support-feedback",
      id: "feedback-backlog",
      severity: "warning",
      titleKey: "insights.feedbackBacklogTitle",
    });
  }

  if (webhookErrorCount > 0) {
    insights.push({
      descriptionKey: "insights.webhookErrorsDescription",
      href: "/admin/donations",
      id: "webhook-errors",
      severity: "critical",
      titleKey: "insights.webhookErrorsTitle",
    });
  }

  if (loginFailureCount >= 10) {
    insights.push({
      descriptionKey: "insights.loginFailuresDescription",
      href: "/admin/registration-security",
      id: "login-failures",
      severity: "warning",
      titleKey: "insights.loginFailuresTitle",
    });
  }

  if (failedReleaseCount > 0 || missingReleaseAssetCount > 0) {
    insights.push({
      descriptionKey: "insights.releaseHealthDescription",
      href: "/admin/releases",
      id: "release-health",
      severity: "warning",
      titleKey: "insights.releaseHealthTitle",
    });
  }

  if (cloudSyncConflictEvents >= 5) {
    insights.push({
      descriptionKey: "insights.cloudSyncConflictsDescription",
      href: "/admin/licenses",
      id: "cloud-sync-conflicts",
      severity: "warning",
      titleKey: "insights.cloudSyncConflictsTitle",
    });
  }

  if (insights.length === 0) {
    insights.push({
      descriptionKey: "insights.steadyDescription",
      href: "/admin/audit-logs",
      id: "steady",
      severity: "success",
      titleKey: "insights.steadyTitle",
    });
  }

  return insights.slice(0, 4);
}

function isPaymentPaused(settings: DashboardRows["operationalSettings"]) {
  const setting = settings.find((item) => item.key === "payment_checkout");
  const value = setting?.value;
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "is_paused" in value && value.is_paused === true);
}

function hasMissingReleaseAsset(release: DashboardRows["releases"][number]) {
  return !release.macos_arm64_primary_url || !release.macos_x64_primary_url || !release.windows_primary_url;
}

function metric(
  id: string,
  value: number,
  format: AdminDashboardMetricFormat,
  href: string,
  comparison?: AdminDashboardComparison,
): AdminDashboardMetric {
  return { comparison, format, href, id, value };
}

export function buildAdminDashboardOverview({
  now,
  periodDays,
  rows,
}: {
  now: Date;
  periodDays: AdminDashboardPeriod;
  rows: DashboardRows;
}): AdminDashboardOverview {
  const currentStart = periodStart(now, periodDays);
  const previousStart = previousPeriodStart(now, periodDays);
  const currentEnd = now;
  const previousEnd = new Date(currentStart.getTime() - 1);

  const paidDonations = rows.donations.filter((donation) => donation.status === "paid");
  const currentDonations = paidDonations.filter((donation) => inRange(donation.paid_at ?? donation.created_at, currentStart, currentEnd));
  const previousDonations = paidDonations.filter((donation) => inRange(donation.paid_at ?? donation.created_at, previousStart, previousEnd));
  const currentRevenue = sum(currentDonations.map((donation) => donation.amount));
  const previousRevenue = sum(previousDonations.map((donation) => donation.amount));

  const currentProfiles = rows.profiles.filter((profile) => inRange(profile.created_at, currentStart, currentEnd));
  const previousProfiles = rows.profiles.filter((profile) => inRange(profile.created_at, previousStart, previousEnd));
  const currentCertificates = rows.certificates.filter((certificate) => inRange(certificate.issued_at, currentStart, currentEnd));
  const previousCertificates = rows.certificates.filter((certificate) => inRange(certificate.issued_at, previousStart, previousEnd));
  const openFeedback = rows.supportFeedback.filter((feedback) => feedback.status !== "closed");
  const activeTrialRedemptions = rows.trialCodeRedemptions.filter((redemption) => new Date(redemption.trial_valid_until).getTime() >= now.getTime());
  const activeTrialCodes = rows.trialCodes.filter((code) => {
    const started = !code.starts_at || new Date(code.starts_at).getTime() <= now.getTime();
    const notEnded = !code.ends_at || new Date(code.ends_at).getTime() >= now.getTime();
    return code.is_active && !code.deleted_at && started && notEnded;
  });
  const activeEntitlements = rows.licenseEntitlements.filter(
    (entitlement) => entitlement.status === "active" && new Date(entitlement.valid_until).getTime() >= now.getTime(),
  );
  const webhookErrors = rows.webhookLogs.filter((log) => log.status === "error" && inRange(log.created_at, currentStart, currentEnd));
  const loginFailures = rows.userLoginHistory.filter((event) => event.success === false && inRange(event.logged_in_at, currentStart, currentEnd));
  const cloudSyncConflicts = rows.cloudSyncUsageEvents.filter(
    (event) => event.event_type === "activate_conflict" && inRange(event.occurred_at, currentStart, currentEnd),
  );
  const failedReleases = rows.releases.filter((release) => release.release_status === "failed");
  const missingReleaseAssets = rows.releases.filter((release) => release.is_published && hasMissingReleaseAsset(release));
  const paymentPaused = isPaymentPaused(rows.operationalSettings);

  const attentionItems: AdminDashboardAttentionItem[] = [
    ...(openFeedback.length > 0
      ? [{
          count: openFeedback.length,
          descriptionKey: "attention.openFeedbackDescription",
          href: "/admin/support-feedback",
          id: "open-feedback",
          severity: "warning" as const,
          titleKey: "attention.openFeedbackTitle",
        }]
      : []),
    ...(webhookErrors.length > 0
      ? [{
          count: webhookErrors.length,
          descriptionKey: "attention.webhookErrorsDescription",
          href: "/admin/donations",
          id: "webhook-errors",
          severity: "critical" as const,
          titleKey: "attention.webhookErrorsTitle",
        }]
      : []),
    ...(failedReleases.length + missingReleaseAssets.length > 0
      ? [{
          count: failedReleases.length + missingReleaseAssets.length,
          descriptionKey: "attention.releaseIssuesDescription",
          href: "/admin/releases",
          id: "release-issues",
          severity: "warning" as const,
          titleKey: "attention.releaseIssuesTitle",
        }]
      : []),
    ...(paymentPaused
      ? [{
          count: 1,
          descriptionKey: "attention.paymentPausedDescription",
          href: "/admin/contribution-pricing",
          id: "payment-paused",
          severity: "critical" as const,
          titleKey: "attention.paymentPausedTitle",
        }]
      : []),
  ];

  return {
    attentionItems,
    health: {
      cloudSyncConflicts: {
        count: cloudSyncConflicts.length,
        href: "/admin/licenses",
        id: "cloud-sync-conflicts",
        severity: cloudSyncConflicts.length > 0 ? "warning" : "success",
      },
      loginFailures: {
        count: loginFailures.length,
        href: "/admin/registration-security",
        id: "login-failures",
        severity: loginFailures.length >= 10 ? "warning" : "success",
      },
      paymentCheckout: {
        count: paymentPaused ? 1 : 0,
        href: "/admin/contribution-pricing",
        id: "payment-checkout",
        severity: paymentPaused ? "critical" : "success",
      },
      releaseHealth: {
        count: failedReleases.length + missingReleaseAssets.length,
        href: "/admin/releases",
        id: "release-health",
        severity: failedReleases.length + missingReleaseAssets.length > 0 ? "warning" : "success",
      },
      webhookErrors: {
        count: webhookErrors.length,
        href: "/admin/donations",
        id: "webhook-errors",
        severity: webhookErrors.length > 0 ? "critical" : "success",
      },
    },
    insights: createDashboardInsightRules({
      cloudSyncConflictEvents: cloudSyncConflicts.length,
      currentRevenue,
      failedReleaseCount: failedReleases.length,
      loginFailureCount: loginFailures.length,
      missingReleaseAssetCount: missingReleaseAssets.length,
      openFeedbackCount: openFeedback.length,
      paymentPaused,
      previousRevenue,
      webhookErrorCount: webhookErrors.length,
    }),
    metrics: {
      activeEntitlements: metric("active-entitlements", activeEntitlements.length, "number", "/admin/licenses"),
      activeTrials: metric("active-trials", activeTrialCodes.length + activeTrialRedemptions.length, "number", "/admin/licenses"),
      certificatesIssued: metric(
        "certificates-issued",
        currentCertificates.length,
        "number",
        "/admin/certificates",
        getMetricComparison(currentCertificates.length, previousCertificates.length),
      ),
      newUsers: metric(
        "new-users",
        currentProfiles.length,
        "number",
        "/admin/users",
        getMetricComparison(currentProfiles.length, previousProfiles.length),
      ),
      openFeedback: metric("open-feedback", openFeedback.length, "number", "/admin/support-feedback"),
      paidSupportCount: metric(
        "paid-support-count",
        currentDonations.length,
        "number",
        "/admin/donations",
        getMetricComparison(currentDonations.length, previousDonations.length),
      ),
      revenue: metric("revenue", currentRevenue, "currency", "/admin/donations", getMetricComparison(currentRevenue, previousRevenue)),
      totalUsers: metric("total-users", rows.profiles.length, "number", "/admin/users"),
    },
    periodDays,
    revenueTrend: fillDashboardTrend({
      now,
      periodDays,
      rows: currentDonations.map((donation) => ({ ...donation, created_at: donation.paid_at ?? donation.created_at })),
      valueKey: "amount",
    }),
    userTrend: fillDashboardTrend({ now, periodDays, rows: currentProfiles }),
  };
}

async function readRows<T>(promise: PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const { data, error } = await promise;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAdminDashboardOverview({
  now = new Date(),
  periodDays,
}: {
  now?: Date;
  periodDays: AdminDashboardPeriod;
}) {
  const supabase = createSupabaseAdminClient();
  const since = previousPeriodStart(now, periodDays).toISOString();

  const [
    profiles,
    donations,
    certificates,
    supportFeedback,
    trialCodes,
    trialCodeRedemptions,
    licenseEntitlements,
    releases,
    webhookLogs,
    userLoginHistory,
    cloudSyncUsageEvents,
    cloudSyncUsageSessions,
    operationalSettings,
  ] = await Promise.all([
    readRows(supabase.from("profiles").select("created_at,account_status")),
    readRows(supabase.from("donations").select("amount,status,paid_at,created_at").gte("created_at", since)),
    readRows(supabase.from("certificates").select("issued_at,status").gte("issued_at", since)),
    readRows(supabase.from("support_feedback").select("status,created_at,updated_at")),
    readRows(supabase.from("trial_codes").select("is_active,deleted_at,starts_at,ends_at")),
    readRows(supabase.from("trial_code_redemptions").select("redeemed_at,trial_valid_until").gte("redeemed_at", since)),
    readRows(supabase.from("license_entitlements").select("status,valid_until")),
    readRows(supabase.from("software_releases").select("is_published,release_status,macos_arm64_primary_url,macos_x64_primary_url,windows_primary_url")),
    readRows(supabase.from("webhook_logs").select("status,created_at").gte("created_at", since)),
    readRows(supabase.from("user_login_history").select("success,logged_in_at").gte("logged_in_at", since)),
    readRows(supabase.from("cloud_sync_usage_events").select("event_type,occurred_at").gte("occurred_at", since)),
    readRows(supabase.from("cloud_sync_usage_sessions").select("started_at").gte("started_at", since)),
    readRows(supabase.from("operational_settings").select("key,value")),
  ]);

  return buildAdminDashboardOverview({
    now,
    periodDays,
    rows: {
      certificates,
      cloudSyncUsageEvents,
      cloudSyncUsageSessions,
      donations,
      licenseEntitlements,
      loginHistory: userLoginHistory,
      operationalSettings,
      profiles,
      releases,
      supportFeedback,
      trialCodeRedemptions,
      trialCodes,
      userLoginHistory,
      webhookLogs,
    },
  });
}
