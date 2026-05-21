import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminCertificateBulkToolbar, AdminCertificateSelectAllCheckbox } from "@/components/admin/admin-certificate-bulk-toolbar";
import { AdminCertificateFilters } from "@/components/admin/admin-certificate-filters";
import { AdminCertificateExport } from "@/components/admin/admin-certificate-export";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeCertificate } from "../actions";
import { AdminCertificateBulkExport } from "@/components/admin/admin-certificate-bulk-export";

type AdminCertificatesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    page?: string;
    query?: string;
    type?: string;
    status?: string;
    issuedFrom?: string;
    issuedTo?: string;
  }>;
};

type CertificateType = "donation" | "honor";
type CertificateStatus = "active" | "revoked" | "generation_failed";

function formatIssuedAt(value: string | null, locale: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getCertificateStatusTone(status: CertificateStatus) {
  if (status === "active") return "success";
  if (status === "revoked") return "danger";
  return "warning";
}

export default async function AdminCertificatesPage({ params, searchParams }: AdminCertificatesPageProps) {
  const { locale: localeParam } = await params;
  const searchParamsState = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/certificates`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/certificates");

  const supabase = await createSupabaseServerClient();
  const PAGE_SIZE = 20;
  const currentPage = Number(searchParamsState?.page ?? 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE - 1;

  let countQuery = supabase.from("certificates").select("id", { count: "exact", head: true });
  let query = supabase
    .from("certificates")
    .select("id,certificate_number,type,status,issued_at");

  const { query: searchQuery, type, status, issuedFrom, issuedTo } = searchParamsState ?? {};

  if (searchQuery) {
    const searchCondition = `certificate_number.ilike.%${searchQuery}%`;
    countQuery = countQuery.ilike("certificate_number", `%${searchQuery}%`);
    query = query.ilike("certificate_number", `%${searchQuery}%`);
  }
  if (type === "donation" || type === "honor") {
    countQuery = countQuery.eq("type", type);
    query = query.eq("type", type);
  }
  if (status === "active" || status === "revoked" || status === "generation_failed") {
    countQuery = countQuery.eq("status", status);
    query = query.eq("status", status);
  }
  if (issuedFrom) {
    countQuery = countQuery.gte("issued_at", new Date(issuedFrom).toISOString());
    query = query.gte("issued_at", new Date(issuedFrom).toISOString());
  }
  if (issuedTo) {
    countQuery = countQuery.lte("issued_at", new Date(issuedTo).toISOString());
    query = query.lte("issued_at", new Date(issuedTo).toISOString());
  }

  const [{ count: totalCount }, { data: certificates, error }] = await Promise.all([
    countQuery,
    query.order("issued_at", { ascending: false }).range(startIndex, endIndex),
  ]);

  if (error) {
    throw error;
  }

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
          <AdminPageHeader
            backHref="/admin"
            backLabel={t("shell.backToAdmin")}
            description={t("certificates.description")}
            eyebrow={t("certificates.eyebrow")}
            title={t("certificates.title")}
          />
          <AdminFeedbackBanner error={searchParamsState?.error} notice={searchParamsState?.notice} />
          <AdminCertificateFilters
            actionPath="/admin/certificates"
            labels={{
              allStatuses: t("certificates.filter.allStatuses"),
              allTypes: t("certificates.filter.allTypes"),
              apply: t("certificates.filter.apply"),
              issuedFrom: t("certificates.filter.issuedFrom"),
              issuedTo: t("certificates.filter.issuedTo"),
              moreFilters: t("certificates.filter.moreFilters"),
              reset: t("certificates.filter.reset"),
              search: t("certificates.filter.search"),
              searchPlaceholder: t("certificates.filter.searchPlaceholder"),
              status: t("certificates.filter.status"),
              type: t("certificates.filter.type"),
            }}
            values={{
              issuedFrom,
              issuedTo,
              query: searchQuery,
              status,
              type,
            }}
          />
          <div className="mt-4 flex justify-end">
            <AdminCertificateExport
              certificates={certificates ?? []}
              locale={locale}
              labels={{
                export: t("certificates.export"),
                exporting: t("certificates.exporting"),
              }}
              typeLabels={{
                donation: t("certificates.types.donation"),
                honor: t("certificates.types.honor"),
              }}
              statusLabels={{
                active: t("certificates.statuses.active"),
                revoked: t("certificates.statuses.revoked"),
                generation_failed: t("certificates.statuses.generation_failed"),
              }}
            />
          </div>
          <AdminCard>
            {certificates && certificates.length > 0 ? (
              <>
                <AdminTableShell label={t("certificates.title")}>
                  <table aria-label={t("certificates.title")} className="min-w-[1120px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[220px]" />
                    <col className="w-[150px]" />
                    <col className="w-[180px]" />
                    <col className="w-[330px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("certificates.certificateNumber")}</th>
                      <th className="px-5 py-3">{t("certificates.type")}</th>
                      <th className="px-5 py-3">{t("certificates.status")}</th>
                      <th className="px-5 py-3">{t("certificates.issued")}</th>
                      <th className="sticky right-0 z-10 w-[330px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("certificates.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {certificates.map((certificate) => (
                      <tr key={certificate.id}>
                        <td className="px-5 py-4 font-mono text-xs text-slate-950">
                          <span className="block break-all">{certificate.certificate_number}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {t(`certificates.types.${certificate.type as CertificateType}`)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          <AdminStatusBadge tone={getCertificateStatusTone(certificate.status as CertificateStatus)}>
                            {t(`certificates.statuses.${certificate.status as CertificateStatus}`)}
                          </AdminStatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatIssuedAt(certificate.issued_at, locale, t("certificates.notIssued"))}
                        </td>
                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          {certificate.status === "active" ? (
                            <form action={revokeCertificate} className="flex min-w-72 gap-2">
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/certificates" />
                              <input name="certificate_id" type="hidden" value={certificate.id} />
                              <label className="sr-only" htmlFor={`revoke-reason-${certificate.id}`}>
                                {t("certificates.revokeReason")}
                              </label>
                              <input
                                className="min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                id={`revoke-reason-${certificate.id}`}
                                maxLength={500}
                                name="reason"
                                placeholder={t("certificates.revokeReason")}
                                required
                              />
                              <ConfirmActionButton
                                aria-label={t("certificates.revokeAriaLabel", {
                                  certificateNumber: certificate.certificate_number,
                                })}
                                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                confirmLabel={t("certificates.revoke")}
                                pendingLabel={t("common.processing")}
                              >
                                {t("certificates.revoke")}
                              </ConfirmActionButton>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
              <AdminPagination
                basePath="/admin/certificates"
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
              <p className="px-5 py-6 text-sm text-slate-600">{t("certificates.empty")}</p>
            )}
          </AdminCard>
      </section>
    </AdminShell>
  );
}
