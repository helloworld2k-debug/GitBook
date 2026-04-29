import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";
import { getCertificateTypeLabel } from "@/lib/certificates/render";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type DonationStatus = "pending" | "paid" | "cancelled" | "failed" | "refunded";
type CertificateType = "donation" | "honor";

function formatDonationAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDashboardDate(value: string | null, locale: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const t = await getTranslations("dashboard");
  const certificateT = await getTranslations("certificate");
  const supabase = await createSupabaseServerClient();

  const [
    { count: donationCount, error: donationCountError },
    { count: certificateCount, error: certificateCountError },
    { data: donations, error: donationsError },
    { data: certificates, error: certificatesError },
  ] = await Promise.all([
    supabase.from("donations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid"),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("donations")
      .select("id,amount,currency,status,paid_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("certificates")
      .select("id,certificate_number,type,issued_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);

  if (donationCountError) {
    throw donationCountError;
  }

  if (certificateCountError) {
    throw certificateCountError;
  }

  if (donationsError) {
    throw donationsError;
  }

  if (certificatesError) {
    throw certificatesError;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{t("donations")}</p>
              <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{donationCount ?? 0}</p>
            </article>
            <article className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{t("certificates")}</p>
              <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{certificateCount ?? 0}</p>
            </article>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("recentDonations")}</h2>
              </div>
              {donations && donations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-5 py-3">{t("amount")}</th>
                        <th className="px-5 py-3">{t("status")}</th>
                        <th className="px-5 py-3">{t("date")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {donations.map((donation) => (
                        <tr key={donation.id}>
                          <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-950">
                            {formatDonationAmount(donation.amount, donation.currency, locale)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                            {t(`donationStatuses.${donation.status as DonationStatus}`)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {formatDashboardDate(donation.paid_at ?? donation.created_at, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-600">{t("noDonations")}</p>
              )}
            </section>
            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("recentCertificates")}</h2>
              </div>
              {certificates && certificates.length > 0 ? (
                <ul className="divide-y divide-slate-200">
                  {certificates.map((certificate) => (
                    <li key={certificate.id} className="px-5 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{certificate.certificate_number}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {getCertificateTypeLabel(certificate.type as CertificateType, {
                              donation: certificateT("types.donation"),
                              honor: certificateT("types.honor"),
                            })}
                            {certificate.issued_at ? ` - ${formatDashboardDate(certificate.issued_at, locale)}` : ""}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/certificates/${certificate.id}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                        >
                          {t("viewCertificate")}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-600">{t("noCertificates")}</p>
              )}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
