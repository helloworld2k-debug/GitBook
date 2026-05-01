import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";

type AdminPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin");

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
