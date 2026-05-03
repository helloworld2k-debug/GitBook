import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DonationTierCard } from "@/components/donation-tier-card";
import { SiteHeader } from "@/components/site-header";
import { donationTiers, supportedLocales, type Locale } from "@/config/site";

type DonatePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DonatePage({ params }: DonatePageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations("donate");

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              GitBook AI
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">{t("subtitle")}</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {donationTiers.map((tier) => (
              <DonationTierCard
                checkoutDodoLabel={t("checkoutDodo")}
                key={tier.code}
                label={t(`tiers.${tier.code}`)}
                locale={locale}
                oneTimeNote={t("oneTimeNote")}
                paymentNote={t("paymentNote")}
                tier={tier}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
