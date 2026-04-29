import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DonationTierCard } from "@/components/donation-tier-card";
import { SiteHeader } from "@/components/site-header";
import { donationTiers, supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";

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
  await requireUser(locale, `/${locale}/donate`);

  const t = await getTranslations("donate");

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{t("subtitle")}</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {donationTiers.map((tier) => (
              <DonationTierCard
                checkoutPayPalLabel={t("checkoutPayPal")}
                checkoutStripeLabel={t("checkoutStripe")}
                key={tier.code}
                label={t(`tiers.${tier.code}`)}
                locale={locale}
                oneTimeNote={t("oneTimeNote")}
                tier={tier}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
