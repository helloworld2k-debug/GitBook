import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LatestCertificatePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LatestCertificatePage({ params }: LatestCertificatePageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/certificates/latest`);
  const supabase = await createSupabaseServerClient();
  const { data: certificate, error } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "donation")
    .eq("status", "active")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!certificate) {
    redirect(`/${locale}/dashboard?payment=dodo-success`);
  }

  redirect(`/${locale}/dashboard/certificates/${certificate.id}?payment=dodo-success`);
}
