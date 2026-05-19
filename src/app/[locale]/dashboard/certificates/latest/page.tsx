import { redirect } from "next/navigation";
import { setupUserPage } from "@/lib/auth/page-guards";
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

const PAYMENT_LOOKUP_ATTEMPTS = 6;
const PAYMENT_LOOKUP_DELAY_MS = 250;

function waitForPaymentWrite() {
  return new Promise((resolve) => setTimeout(resolve, PAYMENT_LOOKUP_DELAY_MS));
}

export default async function LatestCertificatePage({ params, searchParams }: LatestCertificatePageProps) {
  const { locale: localeParam } = await params;
  const status = await searchParams;

  const { locale, user } = await setupUserPage(localeParam, `/${localeParam}/dashboard/certificates/latest`);
  const supabase = await createSupabaseServerClient();

  async function findCertificateForDonation(donationId: string) {
    for (let attempt = 0; attempt < PAYMENT_LOOKUP_ATTEMPTS; attempt += 1) {
      const { data: certificate, error } = await supabase
        .from("certificates")
        .select("id")
        .eq("user_id", user.id)
        .eq("donation_id", donationId)
        .eq("type", "donation")
        .eq("status", "active")
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (certificate) {
        return certificate;
      }

      if (attempt < PAYMENT_LOOKUP_ATTEMPTS - 1) {
        await waitForPaymentWrite();
      }
    }

    return null;
  }

  async function findDonationForCheckout(checkoutStartedAt: string) {
    for (let attempt = 0; attempt < PAYMENT_LOOKUP_ATTEMPTS; attempt += 1) {
      const { data: donation, error } = await supabase
        .from("donations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .gte("paid_at", checkoutStartedAt)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (donation) {
        return donation;
      }

      if (attempt < PAYMENT_LOOKUP_ATTEMPTS - 1) {
        await waitForPaymentWrite();
      }
    }

    return null;
  }

  if (status?.checkout_started_at) {
    const donation = await findDonationForCheckout(status.checkout_started_at);

    if (!donation) {
      redirect(`/${locale}/dashboard?payment=dodo-success`);
    }

    const certificate = await findCertificateForDonation(donation.id);

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
