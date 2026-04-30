import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revokeCertificate } from "../actions";

type AdminCertificatesPageProps = {
  params: Promise<{
    locale: string;
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

export default async function AdminCertificatesPage({ params }: AdminCertificatesPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");

  const supabase = await createSupabaseServerClient();
  const { data: certificates, error } = await supabase
    .from("certificates")
    .select("id,certificate_number,type,status,issued_at")
    .order("issued_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("certificates.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              {t("certificates.title")}
            </h1>
          </div>
          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            {certificates && certificates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("certificates.certificateNumber")}</th>
                      <th className="px-5 py-3">{t("certificates.type")}</th>
                      <th className="px-5 py-3">{t("certificates.status")}</th>
                      <th className="px-5 py-3">{t("certificates.issued")}</th>
                      <th className="px-5 py-3">{t("certificates.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {certificates.map((certificate) => (
                      <tr key={certificate.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">
                          {certificate.certificate_number}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {t(`certificates.types.${certificate.type as CertificateType}`)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {t(`certificates.statuses.${certificate.status as CertificateStatus}`)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatIssuedAt(certificate.issued_at, locale, t("certificates.notIssued"))}
                        </td>
                        <td className="px-5 py-4">
                          {certificate.status === "active" ? (
                            <form action={revokeCertificate} className="flex min-w-72 gap-2">
                              <input name="locale" type="hidden" value={locale} />
                              <input name="certificate_id" type="hidden" value={certificate.id} />
                              <label className="sr-only" htmlFor={`revoke-reason-${certificate.id}`}>
                                {t("certificates.revokeReason")}
                              </label>
                              <input
                                className="min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                id={`revoke-reason-${certificate.id}`}
                                name="reason"
                                placeholder={t("certificates.revokeReason")}
                                required
                              />
                              <button
                                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                type="submit"
                              >
                                {t("certificates.revoke")}
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("certificates.empty")}</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
