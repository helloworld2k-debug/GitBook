import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LatestCertificatePageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    checkout_started_at?: string;
    payment?: string;
  }>;
};

export default async function LatestCertificatePage({ params, searchParams }: LatestCertificatePageProps) {
  const { locale } = await params;
  const status = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard/certificates/latest`);
  const supabase = await createSupabaseServerClient();

  if (status?.checkout_started_at) {
    const { data: donation, error: donationError } = await supabase
      .from("donations")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .gte("paid_at", status.checkout_started_at)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (donationError) {
      throw donationError;
    }

    if (!donation) {
      redirect(`/${locale}/dashboard?payment=dodo-success`);
    }

    const { data: certificate, error } = await supabase
      .from("certificates")
      .select("id")
      .eq("user_id", user.id)
      .eq("donation_id", donation.id)
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
