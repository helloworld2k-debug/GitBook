import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { getCertificateTemplateBackgroundDataUri } from "@/lib/certificates/backgrounds";
import { getCertificateExportFilename, renderCertificateSvg } from "@/lib/certificates/export";
import { getCertificateTypeLabel } from "@/lib/certificates/render";
import { getCertificateTemplate } from "@/lib/certificates/templates";
import { getDonationTierCodeForCertificate } from "@/lib/certificates/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CertificateDownloadRouteContext = {
  params: Promise<{
    format: string;
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

export async function GET(_request: Request, { params }: CertificateDownloadRouteContext) {
  const { format, id, locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  if (format !== "svg") {
    notFound();
  }

  const user = await requireUser(locale, `/${locale}/dashboard/certificates/${id}/download/${format}`);

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

  const certificateNumber = certificate.certificate_number;
  const donationTierCode = await getDonationTierCodeForCertificate(supabase, certificate, user.id);
  const template = getCertificateTemplate(certificate.type, donationTierCode);
  const body = renderCertificateSvg({
    certificateNumber,
    copy: {
      brand: t("brand"),
      certificateNumber: t("certificateNumber"),
      description: t("description"),
      issued: t("issued"),
      pendingIssueDate: t("pendingIssueDate"),
      presentedTo: t("presentedTo"),
      title: t("title"),
    },
    issuedAt: certificate.issued_at,
    label: getCertificateTypeLabel(certificate.type, {
      donation: t("types.donation"),
      honor: t("types.honor"),
    }),
    locale,
    recipientName: getRecipientName(user, t("fallbackRecipient")),
    template,
    templateBackgroundDataUri: getCertificateTemplateBackgroundDataUri(template),
  });

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${getCertificateExportFilename(certificateNumber, "svg")}"`,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
