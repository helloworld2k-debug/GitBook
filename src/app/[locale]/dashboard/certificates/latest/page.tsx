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
const PAYMENT_REFRESH_SECONDS = 2;

function waitForPaymentWrite() {
  return new Promise((resolve) => setTimeout(resolve, PAYMENT_LOOKUP_DELAY_MS));
}

function PendingCertificatePage({ checkoutStartedAt, locale }: { checkoutStartedAt: string; locale: string }) {
  const refreshHref = `/${locale}/dashboard/certificates/latest?payment=dodo-success&checkout_started_at=${encodeURIComponent(checkoutStartedAt)}`;

  return (
    <main className="tech-shell flex-1">
      <meta content={String(PAYMENT_REFRESH_SECONDS)} httpEquiv="refresh" />
      <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 sm:px-6">
        <div
          className="rounded-md border border-cyan-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20"
          role="status"
        >
          <p className="text-sm font-semibold uppercase text-cyan-200">Payment successful</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-white">
            Payment received. Your certificate is being prepared.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This page will refresh automatically while the payment confirmation finishes.
          </p>
          <a
            className="mt-5 inline-flex min-h-10 items-center rounded-md border border-cyan-300/30 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-200 hover:text-white"
            href={refreshHref}
          >
            Check again
          </a>
        </div>
      </section>
    </main>
  );
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
      return <PendingCertificatePage checkoutStartedAt={status.checkout_started_at} locale={locale} />;
    }

    const certificate = await findCertificateForDonation(donation.id);

    if (!certificate) {
      return <PendingCertificatePage checkoutStartedAt={status.checkout_started_at} locale={locale} />;
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
