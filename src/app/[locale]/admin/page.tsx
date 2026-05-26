import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  KeyRound,
  LineChart,
  MessageSquareText,
  Package,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminCard, AdminDataWorkbench, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Link } from "@/i18n/routing";
import {
  formatDashboardMetricValue,
  getAdminDashboardOverview,
  getAdminDashboardPeriod,
  type AdminDashboardAttentionItem,
  type AdminDashboardHealthItem,
  type AdminDashboardInsight,
  type AdminDashboardMetric,
  type AdminDashboardPeriod,
  type AdminDashboardSeverity,
  type AdminDashboardTrendPoint,
} from "@/lib/admin/dashboard";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";

type AdminPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    period?: string | string[];
  }>;
};

const severityTone: Record<AdminDashboardSeverity, "danger" | "neutral" | "success" | "warning"> = {
  critical: "danger",
  info: "neutral",
  success: "success",
  warning: "warning",
};

function formatComparison(metric: AdminDashboardMetric, t: Awaited<ReturnType<typeof getTranslations>>) {
  const comparison = metric.comparison;
  if (!comparison) return null;
  if (comparison.state === "flat") return t("overview.comparisonFlat");
  if (comparison.state === "new") return t("overview.comparisonNew");

  const value = comparison.percent === null ? formatDashboardMetricValue({ format: metric.format, value: Math.abs(comparison.delta) }, "en") : `${Math.abs(comparison.percent)}%`;
  return comparison.delta >= 0
    ? t("overview.comparisonUp", { value })
    : t("overview.comparisonDown", { value });
}

function DashboardSparkline({
  emptyLabel,
  label,
  points,
  stroke = "#0f172a",
}: {
  emptyLabel: string;
  label: string;
  points: AdminDashboardTrendPoint[];
  stroke?: string;
}) {
  const width = 420;
  const height = 132;
  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const coordinates = points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = maxValue === 0 ? height - 12 : height - 12 - (point.value / maxValue) * (height - 24);
    return `${x},${y}`;
  });

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      {maxValue === 0 ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">{emptyLabel}</div>
      ) : (
        <svg aria-label={label} className="h-32 w-full" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
          <polyline fill="none" points={coordinates.join(" ")} stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {points.map((point, index) => {
            const [cx, cy] = coordinates[index].split(",");
            return <circle cx={cx} cy={cy} fill={stroke} key={`${point.date}-${index}`} r="3" />;
          })}
        </svg>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  locale,
  metric,
  t,
}: {
  icon: typeof Gauge;
  label: string;
  locale: string;
  metric: AdminDashboardMetric;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const comparison = formatComparison(metric, t);
  const comparisonPositive = (metric.comparison?.delta ?? 0) >= 0;

  return (
    <Link
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      href={metric.href}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <Icon aria-hidden="true" className="size-4 text-slate-400" />
      </span>
      <span className="mt-3 block text-2xl font-semibold text-slate-950">{formatDashboardMetricValue(metric, locale)}</span>
      {comparison ? (
        <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${comparisonPositive ? "text-emerald-700" : "text-amber-700"}`}>
          {comparisonPositive ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownRight aria-hidden="true" className="size-3" />}
          {comparison}
        </span>
      ) : null}
    </Link>
  );
}

function AttentionCard({ item, t }: { item: AdminDashboardAttentionItem; t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <Link className="block rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" href={item.href}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{t(`overview.${item.titleKey}`)}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{t(`overview.${item.descriptionKey}`)}</p>
        </div>
        <AdminStatusBadge tone={severityTone[item.severity]}>{item.count}</AdminStatusBadge>
      </div>
    </Link>
  );
}

function InsightCard({ insight, t }: { insight: AdminDashboardInsight; t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <Link className="block rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" href={insight.href}>
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${insight.severity === "success" ? "text-emerald-600" : "text-amber-600"}`} />
        <div>
          <p className="text-sm font-semibold text-slate-950">{t(`overview.${insight.titleKey}`)}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{t(`overview.${insight.descriptionKey}`)}</p>
        </div>
      </div>
    </Link>
  );
}

function HealthRow({
  item,
  label,
  t,
}: {
  item: AdminDashboardHealthItem;
  label: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const healthy = item.severity === "success";

  return (
    <Link className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" href={item.href}>
      <span className="flex min-w-0 items-center gap-2">
        {healthy ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-emerald-600" /> : <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-amber-600" />}
        <span className="truncate font-medium text-slate-800">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-slate-500">{item.count}</span>
        <AdminStatusBadge tone={healthy ? "success" : severityTone[item.severity]}>
          {healthy ? t("overview.health.healthy") : t("overview.health.needsReview")}
        </AdminStatusBadge>
      </span>
    </Link>
  );
}

function periodHref(period: AdminDashboardPeriod) {
  return `/admin?period=${period}d`;
}

export default async function AdminPage({ params, searchParams }: AdminPageProps) {
  const { locale: localeParam } = await params;
  const search = await searchParams;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin");
  const periodDays = getAdminDashboardPeriod(search?.period);
  const overview = await getAdminDashboardOverview({ periodDays });

  const metricCards = [
    { icon: Users, label: t("overview.totalUsersMetric"), metric: overview.metrics.totalUsers },
    { icon: Users, label: t("overview.newUsersMetric"), metric: overview.metrics.newUsers },
    { icon: CircleDollarSign, label: t("overview.revenueMetric"), metric: overview.metrics.revenue },
    { icon: BarChart3, label: t("overview.paidSupportMetric"), metric: overview.metrics.paidSupportCount },
    { icon: Activity, label: t("overview.certificatesIssuedMetric"), metric: overview.metrics.certificatesIssued },
    { icon: KeyRound, label: t("overview.activeTrialsMetric"), metric: overview.metrics.activeTrials },
    { icon: KeyRound, label: t("overview.activeEntitlementsMetric"), metric: overview.metrics.activeEntitlements },
    { icon: MessageSquareText, label: t("overview.pendingFeedbackMetric"), metric: overview.metrics.openFeedback },
  ];
  const adminLinks = [
    { description: t("overview.donationsDescription"), href: "/admin/donations", title: t("overview.donationsTitle") },
    { description: t("overview.releasesDescription"), href: "/admin/releases", title: t("overview.releasesTitle") },
    { description: t("overview.licensesDescription"), href: "/admin/licenses", title: t("overview.licensesTitle") },
    { description: t("overview.usersDescription"), href: "/admin/users", title: t("overview.usersTitle") },
    { description: t("overview.supportFeedbackDescription"), href: "/admin/support-feedback", title: t("overview.supportFeedbackTitle") },
    { description: t("overview.registrationSecurityDescription"), href: "/admin/registration-security", title: t("overview.registrationSecurityTitle") },
  ];

  return (
    <AdminShell {...shellProps}>
      <AdminDataWorkbench>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <AdminPageHeader description={t("overview.description")} eyebrow={t("overview.eyebrow")} title={t("overview.title")} />
          <nav aria-label={t("overview.selectedPeriod", { days: periodDays })} className="mb-6 flex flex-wrap gap-2">
            {([7, 30, 90] as const).map((period) => (
              <Link
                aria-current={period === periodDays ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-semibold ${
                  period === periodDays ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                href={periodHref(period)}
                key={period}
              >
                {t(`overview.period${period}`)}
              </Link>
            ))}
          </nav>
        </div>

        <AdminCard className="p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("overview.metricsTitle")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map(({ icon, label, metric }) => (
              <MetricCard icon={icon} key={metric.id} label={label} locale={locale} metric={metric} t={t} />
            ))}
          </div>
        </AdminCard>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
          <AdminCard className="p-5">
            <div className="flex items-center gap-2">
              <LineChart aria-hidden="true" className="size-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-950">{t("overview.chartsTitle")}</h2>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{t("overview.revenueTrendTitle")}</h3>
                <DashboardSparkline emptyLabel={t("overview.chartEmpty")} label={t("overview.revenueTrendTitle")} points={overview.revenueTrend} stroke="#0f766e" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{t("overview.userTrendTitle")}</h3>
                <DashboardSparkline emptyLabel={t("overview.chartEmpty")} label={t("overview.userTrendTitle")} points={overview.userTrend} stroke="#4f46e5" />
              </div>
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="size-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-950">{t("overview.attentionTitle")}</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {overview.attentionItems.length > 0 ? (
                overview.attentionItems.map((item) => <AttentionCard item={item} key={item.id} t={t} />)
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">{t("overview.attentionEmptyTitle")}</p>
                  <p className="mt-1 text-sm text-slate-600">{t("overview.attentionEmptyDescription")}</p>
                </div>
              )}
            </div>
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
          <AdminCard className="p-5">
            <div className="flex items-center gap-2">
              <Gauge aria-hidden="true" className="size-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-950">{t("overview.healthTitle")}</h2>
            </div>
            <div className="mt-4 grid gap-2">
              <HealthRow item={overview.health.paymentCheckout} label={t("overview.health.paymentCheckout")} t={t} />
              <HealthRow item={overview.health.releaseHealth} label={t("overview.health.releaseHealth")} t={t} />
              <HealthRow item={overview.health.webhookErrors} label={t("overview.health.webhookErrors")} t={t} />
              <HealthRow item={overview.health.loginFailures} label={t("overview.health.loginFailures")} t={t} />
              <HealthRow item={overview.health.cloudSyncConflicts} label={t("overview.health.cloudSyncConflicts")} t={t} />
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-950">{t("overview.insightsTitle")}</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {overview.insights.map((insight) => <InsightCard insight={insight} key={insight.id} t={t} />)}
            </div>
          </AdminCard>
        </div>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-slate-950">{t("overview.quickLinksTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {adminLinks.map((link) => (
              <Link className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" href={link.href} key={link.href}>
                <AdminCard className="h-full p-5 transition-colors hover:border-slate-300 hover:shadow-md">
                  <div className="flex items-center gap-2">
                    <Package aria-hidden="true" className="size-4 text-slate-400" />
                    <span className="block text-base font-semibold text-slate-950">{link.title}</span>
                  </div>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{link.description}</span>
                </AdminCard>
              </Link>
            ))}
          </div>
        </section>
      </AdminDataWorkbench>
    </AdminShell>
  );
}
