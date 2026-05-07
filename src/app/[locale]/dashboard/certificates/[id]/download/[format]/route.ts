import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setupUserPage } from "@/lib/auth/page-guards";
import { getCertificateTemplateBackgroundDataUri } from "@/lib/certificates/backgrounds";
import { getCertificateExportFilename, renderCertificateSvg } from "@/lib/certificates/export";
import { formatCertificateAmount, getCertificateTypeLabel } from "@/lib/certificates/render";
import { getCertificateTemplate } from "@/lib/certificates/templates";
import { getDonationDetailsForCertificate } from "@/lib/certificates/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CertificateDownloadRouteContext = {
  params: Promise<{
    format: string;
    id: string;
    locale: string;
  }>;
};

type AuthenticatedUser = Awaited<ReturnType<typeof setupUserPage>>["user"];

function getRecipientName(user: AuthenticatedUser, fallbackRecipient: string) {
  const displayName = user.user_metadata?.name ?? user.user_metadata?.full_name;

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName;
  }

  return user.email ?? fallbackRecipient;
}

export async function GET(_request: Request, { params }: CertificateDownloadRouteContext) {
  const { format, id, locale: localeParam } = await params;

  if (format !== "svg") {
    notFound();
  }

  const { locale, user } = await setupUserPage(localeParam, `/${localeParam}/dashboard/certificates/${id}/download/${format}`);

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
  const donationDetails = await getDonationDetailsForCertificate(supabase, certificate, user.id);
  const template = getCertificateTemplate(certificate.type, donationDetails?.tierCode);
  const body = renderCertificateSvg({
    certificateNumber,
    copy: {
      amount: t("amount"),
      brand: t("brand"),
      certificateNumber: t("certificateNumber"),
      description: t("description"),
      issued: t("issued"),
      pendingIssueDate: t("pendingIssueDate"),
      presentedTo: t("presentedTo"),
      title: t("title"),
    },
    donationAmount: formatCertificateAmount(donationDetails, locale),
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
