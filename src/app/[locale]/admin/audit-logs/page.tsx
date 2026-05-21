import { getTranslations } from "next-intl/server";
import { AdminCard, AdminPageHeader, AdminShell, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminAuditLogFilters } from "@/components/admin/admin-audit-log-filters";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminAuditLogsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    query?: string;
    targetType?: string;
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

export default async function AdminAuditLogsPage({ params, searchParams }: AdminAuditLogsPageProps) {
  const { locale: localeParam } = await params;
  const searchParamsState = await searchParams;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/audit-logs`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/audit-logs");

  const supabase = await createSupabaseServerClient();
  const PAGE_SIZE = 20;
  const currentPage = Number(searchParamsState?.page ?? 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE - 1;

  let countQuery = supabase.from("admin_audit_logs").select("id", { count: "exact", head: true });
  let query = supabase
    .from("admin_audit_logs")
    .select("id,admin_user_id,action,target_type,target_id,reason,created_at,profiles(email)");

  const { action, dateFrom, dateTo, query: searchQuery, targetType } = searchParamsState ?? {};

  if (searchQuery) {
    countQuery = countQuery.or(`action.ilike.%${searchQuery}%,target_id.ilike.%${searchQuery}%,reason.ilike.%${searchQuery}%`);
    query = query.or(`action.ilike.%${searchQuery}%,target_id.ilike.%${searchQuery}%,reason.ilike.%${searchQuery}%`);
  }
  if (action) {
    countQuery = countQuery.ilike("action", `%${action}%`);
    query = query.ilike("action", `%${action}%`);
  }
  if (targetType) {
    countQuery = countQuery.ilike("target_type", `%${targetType}%`);
    query = query.ilike("target_type", `%${targetType}%`);
  }
  if (dateFrom) {
    countQuery = countQuery.gte("created_at", new Date(dateFrom).toISOString());
    query = query.gte("created_at", new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    countQuery = countQuery.lte("created_at", new Date(dateTo).toISOString());
    query = query.lte("created_at", new Date(dateTo).toISOString());
  }

  const [{ count: totalCount }, { data, error }] = await Promise.all([
    countQuery,
    query.order("created_at", { ascending: false }).range(startIndex, endIndex),
  ]);

  if (error) {
    throw error;
  }

  const logs = (data ?? []) as AuditLogRow[];
  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
          <AdminPageHeader
            backHref="/admin"
            backLabel={t("shell.backToAdmin")}
            description={t("auditLogs.description")}
            eyebrow={t("auditLogs.eyebrow")}
            title={t("auditLogs.title")}
          />
          <AdminAuditLogFilters
            actionPath="/admin/audit-logs"
            labels={{
              action: t("auditLogs.filter.action"),
              allActions: t("auditLogs.filter.allActions"),
              apply: t("auditLogs.filter.apply"),
              dateFrom: t("auditLogs.filter.dateFrom"),
              dateTo: t("auditLogs.filter.dateTo"),
              moreFilters: t("auditLogs.filter.moreFilters"),
              reset: t("auditLogs.filter.reset"),
              search: t("auditLogs.filter.search"),
              searchPlaceholder: t("auditLogs.filter.searchPlaceholder"),
              target: t("auditLogs.target"),
              allTargets: t("auditLogs.filter.allTargets"),
            }}
            values={{
              action,
              dateFrom,
              dateTo,
              query: searchQuery,
              targetType,
            }}
          />
          <AdminCard>
            {logs.length > 0 ? (
              <>
                <AdminTableShell label={t("auditLogs.title")}>
                <table aria-label={t("auditLogs.title")} className="min-w-[1080px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[200px]" />
                    <col className="w-[260px]" />
                    <col className="w-[260px]" />
                    <col className="w-[200px]" />
                    <col className="w-[220px]" />
                  </colgroup>
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
                        <td className="px-5 py-4 font-mono text-xs text-slate-700">
                          <span className="block break-all">{log.target_type}/{log.target_id}</span>
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
              </AdminTableShell>
              <AdminPagination
                basePath="/admin/audit-logs"
                currentPage={currentPage}
                totalPages={totalPages}
                labels={{
                  previous: t("pagination.previous"),
                  next: t("pagination.next"),
                  page: t("pagination.page"),
                  of: t("pagination.of"),
                }}
              />
              </>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("auditLogs.empty")}</p>
            )}
          </AdminCard>
      </section>
    </AdminShell>
  );
}
