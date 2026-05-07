import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeCertificate } from "../actions";

type AdminCertificatesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
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
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/certificates`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/certificates");

  const supabase = await createSupabaseServerClient();
  const { data: certificates, error } = await supabase
    .from("certificates")
    .select("id,certificate_number,type,status,issued_at")
    .order("issued_at", { ascending: false });

  if (error) {
    throw error;
  }

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
          <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />
          <AdminCard>
            {certificates && certificates.length > 0 ? (
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
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("certificates.empty")}</p>
            )}
          </AdminCard>
      </section>
    </AdminShell>
  );
}
