import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { getPublicSponsors } from "@/lib/sponsors/public-sponsors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SponsorsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function formatSponsorAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default async function SponsorsPage({ params }: SponsorsPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("sponsors");
  const supabase = await createSupabaseServerClient();
  const sponsorResult = await getPublicSponsors(supabase, t("fallbackDisplayName"))
    .then((sponsors) => ({ sponsors, sponsorLoadFailed: false }))
    .catch(() => ({ sponsors: [], sponsorLoadFailed: true }));
  const { sponsors, sponsorLoadFailed } = sponsorResult;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">{t("subtitle")}</p>
          </div>

          <section className="mt-8 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("wallTitle")}</h2>
            </div>
            {sponsorLoadFailed ? (
              <p className="px-5 py-6 text-sm text-slate-600" role="alert">
                {t("unavailable")}
              </p>
            ) : sponsors.length > 0 ? (
              <ul className="divide-y divide-slate-200">
                {sponsors.map((sponsor) => (
                  <li key={sponsor.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{sponsor.displayName}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {t("paidSummary", {
                            count: sponsor.paidDonationCount,
                            total: formatSponsorAmount(sponsor.paidTotalAmount, sponsor.currency, locale),
                          })}
                        </p>
                      </div>
                      {sponsor.sponsorLevelCode ? (
                        <span className="inline-flex min-h-8 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700">
                          {t(`levels.${sponsor.sponsorLevelCode}`)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("empty")}</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
