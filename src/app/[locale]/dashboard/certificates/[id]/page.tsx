import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { CertificateView, getCertificateTypeLabel } from "@/lib/certificates/render";
import { getCertificateTemplate } from "@/lib/certificates/templates";
import { getDonationTierCodeForCertificate } from "@/lib/certificates/tier";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CertificatePageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

function getRecipientName(user: Awaited<ReturnType<typeof requireUser>>, fallbackRecipient: string) {
  const displayName = user.user_metadata?.name ?? user.user_metadata?.full_name;

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName;
  }

  return user.email ?? fallbackRecipient;
}

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { id, locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/certificates/${id}`);
  const t = await getTranslations("certificate");
  const supabase = await createSupabaseServerClient();

  const { data: certificate, error } = await supabase
    .from("certificates")
    .select("certificate_number,type,issued_at,donation_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!certificate) {
    notFound();
  }

  const donationTierCode = await getDonationTierCodeForCertificate(supabase, certificate, user.id);

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
          <CertificateView
            certificateNumber={certificate.certificate_number}
            copy={{
              brand: t("brand"),
              certificateNumber: t("certificateNumber"),
              description: t("description"),
              issued: t("issued"),
              pendingIssueDate: t("pendingIssueDate"),
              presentedTo: t("presentedTo"),
              title: t("title"),
            }}
            issuedAt={certificate.issued_at}
            label={getCertificateTypeLabel(certificate.type, {
              donation: t("types.donation"),
              honor: t("types.honor"),
            })}
            locale={locale}
            recipientName={getRecipientName(user, t("fallbackRecipient"))}
            template={getCertificateTemplate(certificate.type, donationTierCode)}
          />
          <section
            aria-labelledby="certificate-download-title"
            className="mt-5 rounded-lg border border-cyan-300/15 bg-white/[0.05] px-4 py-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5"
          >
            <div>
              <h2 id="certificate-download-title" className="text-sm font-semibold tracking-normal text-white">
                {t("download.title")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">{t("download.note")}</p>
            </div>
            <a
              href={`/${locale}/dashboard/certificates/${id}/download/svg`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-50 transition-colors hover:border-cyan-200/70 hover:bg-cyan-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:mt-0 sm:w-auto"
            >
              <Download aria-hidden="true" className="size-4" />
              {t("download.svg")}
            </a>
          </section>
        </section>
      </main>
    </>
  );
}
