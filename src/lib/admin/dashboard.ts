import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type AdminDashboardPeriod = 7 | 30 | 90;
export type AdminDashboardCloudSyncWindow = AdminDashboardPeriod | "all";
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

export type AdminDashboardCloudSyncSessionRow = {
  deviceId: string;
  durationSeconds: number;
  endReason: string | null;
  endedAt: string | null;
  id: string;
  lastHeartbeatAt: string;
  startedAt: string;
};

export type AdminDashboardCloudSyncUserRow = {
  active: boolean;
  conflictCount: number;
  cooldownCount: number;
  currentDeviceId: string | null;
  currentPlatform: string | null;
  displayName: string | null;
  email: string | null;
  lastCloudSyncStartedAt: string | null;
  lastDesktopSeenAt: string | null;
  latestSessionDurationSeconds: number;
  sessionCount: number;
  sessions: AdminDashboardCloudSyncSessionRow[];
  totalDurationSeconds: number;
  userId: string;
};

export type AdminDashboardCloudSyncMetrics = {
  activeUsers: number;
  averageSessionDurationSeconds: number;
  enabledUsersInWindow: number;
  entitledUsers: number;
  sessionCount: number;
  totalDurationSeconds: number;
};

export type AdminDashboardOverview = {
  attentionItems: AdminDashboardAttentionItem[];
  cloudSync: {
    metrics: AdminDashboardCloudSyncMetrics;
    users: AdminDashboardCloudSyncUserRow[];
    window: AdminDashboardCloudSyncWindow;
  };
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
  certificates: Array<{ issued_at: string; status: string; user_id: string }>;
  cloudSyncLeases: Array<{
    desktop_session_id: string;
    device_id: string;
    expires_at: string;
    id: string;
    lease_started_at: string;
    released_at: string | null;
    revoked_at: string | null;
    user_id: string;
  }>;
  cloudSyncUsageEvents: Array<{ event_type: string; occurred_at: string; user_id: string }>;
  cloudSyncUsageSessions: Array<{
    device_id: string;
    ended_at: string | null;
    end_reason: string | null;
    id: string;
    last_heartbeat_at: string;
    started_at: string;
    user_id: string;
  }>;
  desktopSessions: Array<{ id: string; last_seen_at: string; platform: string | null; user_id: string }>;
  donations: Array<{ amount: number; created_at: string; paid_at: string | null; status: string }>;
  licenseEntitlements: Array<{ feature_code?: string; status: string; user_id?: string; valid_until: string }>;
  loginHistory: Array<{ logged_in_at: string | null; success: boolean }>;
  operationalSettings: Array<{ key: string; value: Json }>;
  profiles: Array<{ account_status: string; admin_role: string | null; created_at: string; display_name?: string | null; email: string | null; id: string; is_admin: boolean | null }>;
  releases: Array<{
    is_published: boolean;
    macos_arm64_primary_url: string | null;
    macos_x64_primary_url: string | null;
    release_status: string | null;
    windows_primary_url: string | null;
  }>;
  supportFeedback: Array<{ created_at: string; status: string; updated_at: string }>;
  trialCodeRedemptions: Array<{ redeemed_at: string; trial_valid_until: string; user_id: string }>;
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

export function getAdminDashboardCloudSyncWindow(value: string | string[] | null | undefined): AdminDashboardCloudSyncWindow {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "all") return "all";
  return getAdminDashboardPeriod(raw);
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

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function maxDate(values: Array<string | null | undefined>) {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest;
    return timestamp(value) > timestamp(latest) ? value : latest;
  }, null);
}

function usageDurationSeconds(
  session: Pick<DashboardRows["cloudSyncUsageSessions"][number], "ended_at" | "last_heartbeat_at" | "started_at">,
  now: Date,
) {
  const end = timestamp(session.ended_at ?? session.last_heartbeat_at) || now.getTime();
  const start = timestamp(session.started_at);
  if (!start || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

function getCloudSyncWindowStart(now: Date, window: AdminDashboardCloudSyncWindow) {
  return window === "all" ? null : periodStart(now, window);
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

function isTestUserEmail(email: string | null) {
  const normalized = email?.toLowerCase() ?? "";
  return normalized.includes("@example.test") || normalized.startsWith("codex-") || normalized.includes("codex-full-");
}

function isRealUserProfile(profile: DashboardRows["profiles"][number]) {
  return profile.account_status === "active" && !profile.is_admin && (profile.admin_role ?? "user") === "user" && !isTestUserEmail(profile.email);
}

function buildCloudSyncMonitoring({
  now,
  realProfiles,
  rows,
  window,
}: {
  now: Date;
  realProfiles: DashboardRows["profiles"];
  rows: DashboardRows;
  window: AdminDashboardCloudSyncWindow;
}) {
  const realUsersById = new Map(realProfiles.map((profile) => [profile.id, profile]));
  const realUserIds = new Set(realUsersById.keys());
  const windowStart = getCloudSyncWindowStart(now, window);
  const windowEnd = now;

  const activeLeases = rows.cloudSyncLeases.filter((lease) =>
    realUserIds.has(lease.user_id) &&
    !lease.revoked_at &&
    !lease.released_at &&
    timestamp(lease.expires_at) > now.getTime()
  );
  const activeLeaseByUser = new Map<string, DashboardRows["cloudSyncLeases"][number]>();
  for (const lease of activeLeases) {
    const previous = activeLeaseByUser.get(lease.user_id);
    if (!previous || timestamp(lease.lease_started_at) > timestamp(previous.lease_started_at)) {
      activeLeaseByUser.set(lease.user_id, lease);
    }
  }

  const activeCloudSyncEntitlements = rows.licenseEntitlements.filter((entitlement) =>
    realUserIds.has(entitlement.user_id ?? "") &&
    (entitlement.feature_code ?? "cloud_sync") === "cloud_sync" &&
    entitlement.status === "active" &&
    timestamp(entitlement.valid_until) >= now.getTime()
  );
  const entitledUserIds = new Set(activeCloudSyncEntitlements.map((entitlement) => entitlement.user_id).filter(Boolean));

  const sessionsInWindow = rows.cloudSyncUsageSessions.filter((session) =>
    realUserIds.has(session.user_id) &&
    (!windowStart || inRange(session.started_at, windowStart, windowEnd))
  );
  const eventsInWindow = rows.cloudSyncUsageEvents.filter((event) =>
    realUserIds.has(event.user_id) &&
    (!windowStart || inRange(event.occurred_at, windowStart, windowEnd))
  );

  const desktopSessionsByUser = new Map<string, DashboardRows["desktopSessions"]>();
  for (const session of rows.desktopSessions.filter((session) => realUserIds.has(session.user_id))) {
    const entries = desktopSessionsByUser.get(session.user_id) ?? [];
    entries.push(session);
    desktopSessionsByUser.set(session.user_id, entries);
  }

  const sessionsByUser = new Map<string, DashboardRows["cloudSyncUsageSessions"]>();
  for (const session of sessionsInWindow) {
    const entries = sessionsByUser.get(session.user_id) ?? [];
    entries.push(session);
    sessionsByUser.set(session.user_id, entries);
  }

  const eventsByUser = new Map<string, DashboardRows["cloudSyncUsageEvents"]>();
  for (const event of eventsInWindow) {
    const entries = eventsByUser.get(event.user_id) ?? [];
    entries.push(event);
    eventsByUser.set(event.user_id, entries);
  }

  const relevantUserIds = new Set<string>([
    ...activeLeaseByUser.keys(),
    ...(Array.from(entitledUserIds).filter((id): id is string => typeof id === "string")),
    ...sessionsByUser.keys(),
    ...eventsByUser.keys(),
  ]);

  const users: AdminDashboardCloudSyncUserRow[] = Array.from(relevantUserIds)
    .reduce<AdminDashboardCloudSyncUserRow[]>((items, userId) => {
      const profile = realUsersById.get(userId);
      if (!profile) return items;

      const userSessions = (sessionsByUser.get(userId) ?? []).sort((left, right) => timestamp(right.started_at) - timestamp(left.started_at));
      const userEvents = eventsByUser.get(userId) ?? [];
      const userDesktopSessions = desktopSessionsByUser.get(userId) ?? [];
      const latestDesktopSession = userDesktopSessions.reduce<DashboardRows["desktopSessions"][number] | null>((latest, session) => {
        if (!latest || timestamp(session.last_seen_at) > timestamp(latest.last_seen_at)) return session;
        return latest;
      }, null);
      const activeLease = activeLeaseByUser.get(userId);
      const currentDesktopSession = activeLease
        ? userDesktopSessions.find((session) => session.id === activeLease.desktop_session_id) ?? null
        : null;
      const sessionRows = userSessions.slice(0, 3).map<AdminDashboardCloudSyncSessionRow>((session) => ({
        deviceId: session.device_id,
        durationSeconds: usageDurationSeconds(session, now),
        endReason: session.end_reason,
        endedAt: session.ended_at,
        id: session.id,
        lastHeartbeatAt: session.last_heartbeat_at,
        startedAt: session.started_at,
      }));
      const durations = userSessions.map((session) => usageDurationSeconds(session, now));
      const latestSession = userSessions[0];
      const lastCloudSyncStartedAt = maxDate([
        ...userSessions.map((session) => session.started_at),
        ...rows.cloudSyncLeases.filter((lease) => lease.user_id === userId).map((lease) => lease.lease_started_at),
      ]);

      items.push({
        active: Boolean(activeLease),
        conflictCount: userEvents.filter((event) => event.event_type === "activate_conflict").length,
        cooldownCount: userEvents.filter((event) => event.event_type === "cooldown_waiting").length,
        currentDeviceId: activeLease?.device_id ?? latestSession?.device_id ?? null,
        currentPlatform: currentDesktopSession?.platform ?? latestDesktopSession?.platform ?? null,
        displayName: profile.display_name ?? null,
        email: profile.email,
        lastCloudSyncStartedAt,
        lastDesktopSeenAt: latestDesktopSession?.last_seen_at ?? null,
        latestSessionDurationSeconds: latestSession ? usageDurationSeconds(latestSession, now) : 0,
        sessionCount: userSessions.length,
        sessions: sessionRows,
        totalDurationSeconds: sum(durations),
        userId,
      });
      return items;
    }, [])
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return timestamp(right.lastCloudSyncStartedAt) - timestamp(left.lastCloudSyncStartedAt);
    })
    .slice(0, 25);

  const totalDurationSeconds = sum(sessionsInWindow.map((session) => usageDurationSeconds(session, now)));
  const enabledUsersInWindow = new Set(sessionsInWindow.map((session) => session.user_id)).size;

  return {
    metrics: {
      activeUsers: activeLeaseByUser.size,
      averageSessionDurationSeconds: sessionsInWindow.length > 0 ? Math.round(totalDurationSeconds / sessionsInWindow.length) : 0,
      enabledUsersInWindow,
      entitledUsers: entitledUserIds.size,
      sessionCount: sessionsInWindow.length,
      totalDurationSeconds,
    },
    users,
    window,
  };
}

export function buildAdminDashboardOverview({
  cloudSyncWindow = 30,
  now,
  periodDays,
  rows,
}: {
  cloudSyncWindow?: AdminDashboardCloudSyncWindow;
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
  const currentRevenue = 0;
  const previousRevenue = 0;

  const realProfiles = rows.profiles.filter(isRealUserProfile);
  const realUserIds = new Set(realProfiles.map((profile) => profile.id));
  const currentProfiles: Array<Record<string, string | number | null>> = [];
  const realCertificates = rows.certificates.filter((certificate) => realUserIds.has(certificate.user_id));
  const currentCertificates = realCertificates;
  const openFeedback = rows.supportFeedback.filter((feedback) => feedback.status !== "closed");
  const activeTrialRedemptions = rows.trialCodeRedemptions.filter((redemption) => realUserIds.has(redemption.user_id) && new Date(redemption.trial_valid_until).getTime() >= now.getTime());
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
  const cloudSync = buildCloudSyncMonitoring({ now, realProfiles, rows, window: cloudSyncWindow });

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
    cloudSync,
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
      activeTrials: metric("active-trials", activeTrialRedemptions.length, "number", "/admin/licenses"),
      certificatesIssued: metric(
        "certificates-issued",
        currentCertificates.length,
        "number",
        "/admin/certificates",
      ),
      newUsers: metric(
        "new-users",
        currentProfiles.length,
        "number",
        "/admin/users",
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
      totalUsers: metric("total-users", realProfiles.length, "number", "/admin/users"),
    },
    periodDays,
    revenueTrend: fillDashboardTrend({ now, periodDays, rows: [], valueKey: "amount" }),
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
  cloudSyncWindow = 30,
  now = new Date(),
  periodDays,
}: {
  cloudSyncWindow?: AdminDashboardCloudSyncWindow;
  now?: Date;
  periodDays: AdminDashboardPeriod;
}) {
  const supabase = createSupabaseAdminClient();
  const since = previousPeriodStart(now, periodDays).toISOString();
  const cloudSyncStart = getCloudSyncWindowStart(now, cloudSyncWindow);
  const cloudSyncSince = cloudSyncStart ? cloudSyncStart.toISOString() : null;
  const cloudSyncQuerySince = cloudSyncSince && timestamp(cloudSyncSince) > timestamp(since) ? since : cloudSyncSince;

  const cloudSyncUsageEventsQuery = supabase
    .from("cloud_sync_usage_events")
    .select("user_id,event_type,occurred_at");
  const cloudSyncUsageSessionsQuery = supabase
    .from("cloud_sync_usage_sessions")
    .select("id,user_id,device_id,started_at,last_heartbeat_at,ended_at,end_reason")
    .order("started_at", { ascending: false });

  const [
    profiles,
    donations,
    certificates,
    supportFeedback,
    trialCodeRedemptions,
    licenseEntitlements,
    desktopSessions,
    cloudSyncLeases,
    releases,
    webhookLogs,
    userLoginHistory,
    cloudSyncUsageEvents,
    cloudSyncUsageSessions,
    operationalSettings,
  ] = await Promise.all([
    readRows(supabase.from("profiles").select("id,email,display_name,created_at,account_status,admin_role,is_admin")),
    readRows(supabase.from("donations").select("amount,status,paid_at,created_at").gte("created_at", since)),
    readRows(supabase.from("certificates").select("user_id,issued_at,status").gte("issued_at", since)),
    readRows(supabase.from("support_feedback").select("status,created_at,updated_at")),
    readRows(supabase.from("trial_code_redemptions").select("user_id,redeemed_at,trial_valid_until").gte("redeemed_at", since)),
    readRows(supabase.from("license_entitlements").select("user_id,feature_code,status,valid_until")),
    readRows(supabase.from("desktop_sessions").select("id,user_id,last_seen_at,platform").order("last_seen_at", { ascending: false }).limit(500)),
    readRows(supabase.from("cloud_sync_leases").select("id,user_id,desktop_session_id,device_id,lease_started_at,expires_at,revoked_at,released_at").order("lease_started_at", { ascending: false }).limit(500)),
    readRows(supabase.from("software_releases").select("is_published,release_status,macos_arm64_primary_url,macos_x64_primary_url,windows_primary_url")),
    readRows(supabase.from("webhook_logs").select("status,created_at").gte("created_at", since)),
    readRows(supabase.from("user_login_history").select("success,logged_in_at").gte("logged_in_at", since)),
    readRows(cloudSyncQuerySince ? cloudSyncUsageEventsQuery.gte("occurred_at", cloudSyncQuerySince) : cloudSyncUsageEventsQuery),
    readRows(cloudSyncSince ? cloudSyncUsageSessionsQuery.gte("started_at", cloudSyncSince).limit(500) : cloudSyncUsageSessionsQuery.limit(500)),
    readRows(supabase.from("operational_settings").select("key,value")),
  ]);

  return buildAdminDashboardOverview({
    cloudSyncWindow,
    now,
    periodDays,
    rows: {
      certificates,
      cloudSyncLeases,
      cloudSyncUsageEvents,
      cloudSyncUsageSessions,
      desktopSessions,
      donations,
      licenseEntitlements,
      loginHistory: userLoginHistory,
      operationalSettings,
      profiles,
      releases,
      supportFeedback,
      trialCodeRedemptions,
      userLoginHistory,
      webhookLogs,
    },
  });
}
