import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { DonationTierCard } from "@/components/donation-tier-card";
import { PaymentStatusBanner } from "@/components/payment-status-banner";
import { donationTiers, supportedLocales } from "@/config/site";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { getLoginRedirectPath } from "@/lib/auth/guards";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { defaultPaymentMaintenanceMessage, getPaymentCheckoutStatus, type PaymentCheckoutStatusClient } from "@/lib/payments/maintenance";
import { getActiveDonationTiers } from "@/lib/payments/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContributionsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function ContributionsPage({ params }: ContributionsPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);

  const t = await getTranslations("donate");
  const fallbackTiers = donationTiers.map((tier, index) => ({ ...tier, sortOrder: index + 1 }));
  const supabase = await createSupabaseServerClient().catch(() => null);

  const [tiersResult, authResult, paymentCheckoutStatus] = supabase
    ? await Promise.all([
        getActiveDonationTiers(supabase),
        optionalTimeout(supabase.auth.getUser(), 900).catch(() => null),
        getPaymentCheckoutStatus(supabase as unknown as PaymentCheckoutStatusClient),
      ])
    : [fallbackTiers, null, { isPaused: false, message: null }];

  const tiers = tiersResult;
  const user = authResult?.data.user ?? null;
  const isAuthenticated = Boolean(user);
  const loginHref = getLoginRedirectPath(locale, `/${locale}/contributions`);
  const paymentMaintenanceMessage = paymentCheckoutStatus.message ?? defaultPaymentMaintenanceMessage;

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              GitBook AI
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">{t("subtitle")}</p>
            <Suspense fallback={null}>
              <PaymentStatusBanner message={t("cancelled")} />
            </Suspense>
            {paymentCheckoutStatus.isPaused ? (
              <div className="mt-5 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-amber-50">
                <p className="text-sm font-semibold">{t("paymentMaintenanceTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-amber-100">{paymentMaintenanceMessage}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <DonationTierCard
                checkoutDodoLabel={t("checkoutDodo")}
                isAuthenticated={isAuthenticated}
                isPaymentPaused={paymentCheckoutStatus.isPaused}
                key={tier.code}
                label={t(`tiers.${tier.code}`)}
                loginHref={loginHref}
                loginLabel={t("loginToContribute")}
                locale={locale}
                oneTimeNote={t("oneTimeNote")}
                paymentMaintenanceMessage={paymentMaintenanceMessage}
                paymentNote={t("paymentNote")}
                redirectingLabel={t("redirecting")}
                tier={tier}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
