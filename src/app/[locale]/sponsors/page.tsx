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
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">{t("subtitle")}</p>
          </div>

          <section className="glass-panel mt-8 rounded-lg">
            <div className="border-b border-cyan-300/10 px-5 py-4">
              <h2 className="text-lg font-semibold tracking-normal text-white">{t("wallTitle")}</h2>
            </div>
            {sponsorLoadFailed ? (
              <p className="px-5 py-6 text-sm text-slate-300" role="alert">
                {t("unavailable")}
              </p>
            ) : sponsors.length > 0 ? (
              <ul className="divide-y divide-cyan-300/10">
                {sponsors.map((sponsor) => (
                  <li key={sponsor.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">{sponsor.displayName}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {t("paidSummary", {
                            count: sponsor.paidDonationCount,
                            total: formatSponsorAmount(sponsor.paidTotalAmount, sponsor.currency, locale),
                          })}
                        </p>
                      </div>
                      {sponsor.sponsorLevelCode ? (
                        <span className="inline-flex min-h-8 w-fit items-center rounded-md border border-violet-300/20 bg-violet-300/10 px-3 text-sm font-medium text-violet-100">
                          {t(`levels.${sponsor.sponsorLevelCode}`)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-300">{t("empty")}</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
