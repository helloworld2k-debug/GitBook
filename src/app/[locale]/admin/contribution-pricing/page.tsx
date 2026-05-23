import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { getManageableDonationTiers } from "@/lib/payments/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDonationTier, updatePaymentProductSetting } from "../actions";

type PaymentProductEnvironment = "test" | "live";
type PaymentProductTierCode = "monthly" | "quarterly" | "yearly";

type PaymentProductSettingRow = {
  environment: PaymentProductEnvironment;
  is_enabled: boolean;
  product_id: string;
  tier_code: PaymentProductTierCode;
};

const defaultDodoProductIds: Record<PaymentProductEnvironment, Record<PaymentProductTierCode, string>> = {
  test: {
    monthly: "pdt_0Ne1tWOH7HdGEH1kyyAKx",
    quarterly: "pdt_0Ne1tebquro8ZGf0Chqjv",
    yearly: "pdt_0Ne1tm1B9YujqPv0e9QOI",
  },
  live: {
    monthly: "pdt_0NfSHqPkQZGNWArp4uJAF",
    quarterly: "pdt_0NfSHxjFX1RpH7lW8fk6k",
    yearly: "pdt_0NfSI4XGVWDVQ4Kt08DEz",
  },
};

type AdminContributionPricingPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ channel?: string; error?: string; notice?: string }>;
};

function formatDollarInput(amountInCents: number | null | undefined) {
  const amount = (amountInCents ?? 0) / 100;

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getDiscountPercent(amount: number, compareAtAmount: number | null) {
  if (!compareAtAmount || compareAtAmount <= amount) {
    return 0;
  }

  return Math.round((1 - amount / compareAtAmount) * 100);
}

async function getPaymentProductSettings(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    const { data } = await supabase
      .from("payment_product_settings")
      .select("environment,tier_code,product_id,is_enabled")
      .order("environment", { ascending: true });

    return (data ?? []) as PaymentProductSettingRow[];
  } catch {
    return [];
  }
}

function findPaymentProductSetting(
  rows: PaymentProductSettingRow[],
  environment: PaymentProductEnvironment,
  tierCode: PaymentProductTierCode,
) {
  return rows.find((row) => row.environment === environment && row.tier_code === tierCode);
}

function getPaymentProductEnvFallback(environment: PaymentProductEnvironment, tierCode: PaymentProductTierCode) {
  const envByTier: Record<PaymentProductTierCode, string> = {
    monthly: "DODO_PRODUCT_MONTHLY",
    quarterly: "DODO_PRODUCT_QUARTERLY",
    yearly: "DODO_PRODUCT_YEARLY",
  };
  const liveEnvByTier: Record<PaymentProductTierCode, string> = {
    monthly: "DODO_LIVE_PRODUCT_MONTHLY",
    quarterly: "DODO_LIVE_PRODUCT_QUARTERLY",
    yearly: "DODO_LIVE_PRODUCT_YEARLY",
  };
  const envName = environment === "live" ? liveEnvByTier[tierCode] : envByTier[tierCode];

  return process.env[envName] ?? defaultDodoProductIds[environment][tierCode];
}

export default async function AdminContributionPricingPage({ params, searchParams }: AdminContributionPricingPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/contribution-pricing`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/contribution-pricing");
  const supabase = await createSupabaseServerClient();
  const donationTierRows = await getManageableDonationTiers(supabase);
  const paymentProductRows = await getPaymentProductSettings(supabase);
  const paymentEnvironments: PaymentProductEnvironment[] = ["test", "live"];
  const paymentTierCodes: PaymentProductTierCode[] = ["monthly", "quarterly", "yearly"];

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("contributionPricing.description")}
          eyebrow={t("contributionPricing.eyebrow")}
          title={t("contributionPricing.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <AdminCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("contributionPricing.tiersTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("contributionPricing.tiersDescription")}</p>
          </div>
          <div className="grid gap-4 bg-slate-50/60 p-4 sm:p-5">
            {donationTierRows.map((tier) => (
              <form
                action={updateDonationTier}
                className={`grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 xl:grid-cols-12 ${
                  feedback?.notice === "donation-tier-updated" && feedback?.channel === tier.id
                    ? "border-emerald-200 bg-emerald-50/60"
                    : ""
                }`}
                key={tier.id}
              >
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/contribution-pricing?channel=${tier.id}`} />
                <input name="tier_id" type="hidden" value={tier.id} />
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-3">
                  {t("contributionPricing.tierLabel")}
                  <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm" defaultValue={tier.label} name="label" required />
                  <span className="font-mono text-xs text-slate-500">{tier.code}</span>
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-5">
                  {t("contributionPricing.tierDescription")}
                  <textarea className="min-h-28 min-w-0 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" defaultValue={tier.description} name="description" required />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-2">
                  {t("contributionPricing.tierPrice")}
                  <input
                    className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={formatDollarInput(tier.compareAtAmount ?? tier.amount)}
                    min="0.01"
                    name="price"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-2">
                  {t("contributionPricing.tierDiscountPercent")}
                  <input
                    className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={getDiscountPercent(tier.amount, tier.compareAtAmount)}
                    max="99"
                    min="0"
                    name="discount_percent"
                    required
                    step="1"
                    type="number"
                  />
                </label>
                <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700 sm:col-span-1 xl:col-span-3">
                  {t("contributionPricing.status")}
                  <span className="inline-flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
                    <span className="text-sm text-slate-700">{tier.isActive ? t("contributionPricing.tierActive") : t("contributionPricing.tierInactive")}</span>
                    <span className={`relative ml-3 inline-flex h-6 w-11 items-center rounded-full transition-colors ${tier.isActive ? "bg-slate-950" : "bg-slate-300"}`}>
                      <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${tier.isActive ? "translate-x-5" : "translate-x-0"}`} />
                      <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={tier.isActive} name="is_active" type="checkbox" />
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{t("contributionPricing.tierStatusHelp")}</span>
                </label>
                <div className="flex min-w-0 items-end sm:col-span-1 xl:col-span-9 xl:justify-end">
                  <div className="flex w-full flex-col gap-2 sm:max-w-56">
                    <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800" pendingLabel={t("common.saving")}>
                      {t("contributionPricing.save")}
                    </AdminSubmitButton>
                    {feedback?.notice === "donation-tier-updated" && feedback?.channel === tier.id ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        <p className="font-semibold">{t("contributionPricing.tierSaved")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
            ))}
          </div>
        </AdminCard>

        <AdminCard className="mt-6 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("contributionPricing.paymentSettingsTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("contributionPricing.paymentSettingsDescription")}</p>
            <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-sm font-semibold text-cyan-950">{t("contributionPricing.paymentSettingsRuntimeTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-cyan-900">{t("contributionPricing.paymentSettingsRuntimeBody")}</p>
            </div>
          </div>
          <div className="grid gap-5 bg-slate-50/60 p-4 sm:p-5">
            {paymentEnvironments.map((environment) => (
              <section className="rounded-md border border-slate-200 bg-white shadow-sm" key={environment}>
                <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {environment === "live" ? t("contributionPricing.paymentEnvironmentLive") : t("contributionPricing.paymentEnvironmentTest")}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {environment === "live" ? t("contributionPricing.paymentEnvironmentLiveHelp") : t("contributionPricing.paymentEnvironmentTestHelp")}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${environment === "live" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                      {environment === "live" ? "LIVE" : "TEST"}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-slate-200">
                  {paymentTierCodes.map((tierCode) => {
                    const setting = findPaymentProductSetting(paymentProductRows, environment, tierCode);
                    const channel = `${environment}-${tierCode}`;
                    const productId = setting?.product_id ?? getPaymentProductEnvFallback(environment, tierCode);

                    return (
                      <form
                        action={updatePaymentProductSetting}
                        className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.75fr)_minmax(20rem,1.7fr)_minmax(10rem,180px)_minmax(9rem,170px)]"
                        key={channel}
                      >
                        <input name="locale" type="hidden" value={locale} />
                        <input name="return_to" type="hidden" value={`/admin/contribution-pricing?channel=${channel}`} />
                        <input name="environment" type="hidden" value={environment} />
                        <input name="tier_code" type="hidden" value={tierCode} />
                        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                          {t("contributionPricing.tierLabel")}
                          <input className="min-h-11 min-w-0 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm" readOnly value={t(`contributionPricing.paymentTier.${tierCode}`)} />
                        </label>
                        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                          {t("contributionPricing.paymentProductId")}
                          <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 font-mono text-sm" defaultValue={productId} name="product_id" placeholder="pdt_..." required />
                          <span className="text-xs leading-5 text-slate-500">{t("contributionPricing.paymentProductHelp")}</span>
                        </label>
                        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
                          {t("contributionPricing.status")}
                          <span className="inline-flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
                            <span className="text-sm text-slate-700">{setting?.is_enabled !== false ? t("contributionPricing.paymentProductEnabled") : t("contributionPricing.paymentProductDisabled")}</span>
                            <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${setting?.is_enabled !== false ? "bg-slate-950" : "bg-slate-300"}`}>
                              <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${setting?.is_enabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                              <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={setting?.is_enabled !== false} name="is_enabled" type="checkbox" />
                            </span>
                          </span>
                        </label>
                        <div className="flex min-w-0 items-end md:col-span-2 xl:col-span-1 xl:justify-end">
                          <div className="flex w-full flex-col gap-2 sm:max-w-48">
                            <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800" pendingLabel={t("common.saving")}>
                              {t("contributionPricing.saveProduct")}
                            </AdminSubmitButton>
                            {feedback?.notice === "payment-product-updated" && feedback?.channel === channel ? (
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                <p className="font-semibold">{t("contributionPricing.paymentProductSaved")}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </form>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </AdminCard>
      </section>
    </AdminShell>
  );
}
