import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { CertificateView, getCertificateTypeLabel } from "@/lib/certificates/render";
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
    .select("certificate_number,type,issued_at")
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

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
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
          />
          <section
            aria-labelledby="certificate-download-title"
            className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4"
          >
            <div>
              <h2 id="certificate-download-title" className="text-sm font-semibold tracking-normal text-slate-950">
                {t("download.title")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("download.note")}</p>
            </div>
            <a
              href={`/${locale}/dashboard/certificates/${id}/download/svg`}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:mt-0"
            >
              {t("download.svg")}
            </a>
          </section>
        </section>
      </main>
    </>
  );
}
