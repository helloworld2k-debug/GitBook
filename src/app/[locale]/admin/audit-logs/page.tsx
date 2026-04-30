import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminAuditLogsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type AuditLogRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  profiles: { email: string | null } | null;
};

function formatCreatedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminAuditLogsPage({ params }: AdminAuditLogsPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id,admin_user_id,action,target_type,target_id,reason,created_at,profiles(email)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const logs = (data ?? []) as AuditLogRow[];

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("auditLogs.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              {t("auditLogs.title")}
            </h1>
          </div>
          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            {logs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("auditLogs.action")}</th>
                      <th className="px-5 py-3">{t("auditLogs.target")}</th>
                      <th className="px-5 py-3">{t("auditLogs.reason")}</th>
                      <th className="px-5 py-3">{t("auditLogs.createdAt")}</th>
                      <th className="px-5 py-3">{t("auditLogs.admin")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">
                          {log.action}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {log.target_type}/{log.target_id}
                        </td>
                        <td className="max-w-sm px-5 py-4 text-slate-700">{log.reason}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatCreatedAt(log.created_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          <span className="block font-mono text-xs">{log.admin_user_id}</span>
                          {log.profiles?.email ? <span className="block">{log.profiles.email}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("auditLogs.empty")}</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
