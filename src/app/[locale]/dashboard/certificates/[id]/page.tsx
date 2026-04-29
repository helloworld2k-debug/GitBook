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
        </section>
      </main>
    </>
  );
}
