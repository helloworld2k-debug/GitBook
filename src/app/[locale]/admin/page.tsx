import { getTranslations } from "next-intl/server";
import { AdminCard, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale: localeParam } = await params;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin");
  let usersCount = 0;
  let activeTrialsCount = 0;
  let feedbackCount = 0;
  let donationsCount = 0;

  try {
    const supabase = createSupabaseAdminClient();
    const [usersMetric, activeTrialsMetric, feedbackMetric, donationsMetric] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).limit(0),
      supabase.from("trial_codes").select("id", { count: "exact", head: true }).eq("is_active", true).is("deleted_at", null).limit(0),
      supabase.from("support_feedback").select("id", { count: "exact", head: true }).eq("status", "open").limit(0),
      supabase.from("donations").select("id", { count: "exact", head: true }).eq("status", "paid").limit(0),
    ]);
    usersCount = usersMetric.count ?? 0;
    activeTrialsCount = activeTrialsMetric.count ?? 0;
    feedbackCount = feedbackMetric.count ?? 0;
    donationsCount = donationsMetric.count ?? 0;
  } catch {
    usersCount = 0;
    activeTrialsCount = 0;
    feedbackCount = 0;
    donationsCount = 0;
  }

  const metrics = [
    {
      href: "/admin/users",
      label: t("overview.totalUsersMetric"),
      value: usersCount,
    },
    {
      href: "/admin/licenses",
      label: t("overview.activeTrialsMetric"),
      value: activeTrialsCount,
    },
    {
      href: "/admin/support-feedback",
      label: t("overview.pendingFeedbackMetric"),
      value: feedbackCount,
    },
    {
      href: "/admin/donations",
      label: t("overview.recentContributionsMetric"),
      value: donationsCount,
    },
  ];

  const adminLinks = [
    {
      href: "/admin/donations",
      title: t("overview.donationsTitle"),
      description: t("overview.donationsDescription"),
    },
    {
      href: "/admin/certificates",
      title: t("overview.certificatesTitle"),
      description: t("overview.certificatesDescription"),
    },
    {
      href: "/admin/releases",
      title: t("overview.releasesTitle"),
      description: t("overview.releasesDescription"),
    },
    {
      href: "/admin/notifications",
      title: t("overview.notificationsTitle"),
      description: t("overview.notificationsDescription"),
    },
    {
      href: "/admin/support-feedback",
      title: t("overview.supportFeedbackTitle"),
      description: t("overview.supportFeedbackDescription"),
    },
    {
      href: "/admin/contribution-pricing",
      title: t("overview.contributionPricingTitle"),
      description: t("overview.contributionPricingDescription"),
    },
    {
      href: "/admin/support-settings",
      title: t("overview.supportSettingsTitle"),
      description: t("overview.supportSettingsDescription"),
    },
    {
      href: "/admin/policies",
      title: t("overview.policyPagesTitle"),
      description: t("overview.policyPagesDescription"),
    },
    {
      href: "/admin/licenses",
      title: t("overview.licensesTitle"),
      description: t("overview.licensesDescription"),
    },
    {
      href: "/admin/users",
      title: t("overview.usersTitle"),
      description: t("overview.usersDescription"),
    },
    {
      href: "/admin/audit-logs",
      title: t("overview.auditLogsTitle"),
      description: t("overview.auditLogsDescription"),
    },
  ];

  return (
    <AdminShell {...shellProps}>
      <AdminPageHeader description={t("overview.description")} eyebrow={t("overview.eyebrow")} title={t("overview.title")} />
      <section className="mx-auto max-w-7xl">
          <AdminCard className="mb-6 p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("overview.metricsTitle")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  href={metric.href}
                  key={metric.href}
                >
                  <span className="block text-sm font-medium text-slate-600">{metric.label}</span>
                  <span className="mt-2 block text-3xl font-semibold text-slate-950">{metric.value}</span>
                </Link>
              ))}
            </div>
          </AdminCard>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <AdminCard className="h-full p-5 transition-colors hover:border-slate-300 hover:shadow-md">
                  <span className="block text-base font-semibold text-slate-950">{link.title}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{link.description}</span>
                </AdminCard>
              </Link>
            ))}
          </div>
      </section>
    </AdminShell>
  );
}
