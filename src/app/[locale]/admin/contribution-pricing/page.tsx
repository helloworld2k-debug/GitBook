import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { getManageableDonationTiers } from "@/lib/payments/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDonationTier } from "../actions";

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

export default async function AdminContributionPricingPage({ params, searchParams }: AdminContributionPricingPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/contribution-pricing`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/contribution-pricing");
  const supabase = await createSupabaseServerClient();
  const donationTierRows = await getManageableDonationTiers(supabase);

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

        <AdminCard>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("contributionPricing.tiersTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("contributionPricing.tiersDescription")}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {donationTierRows.map((tier) => (
              <form
                action={updateDonationTier}
                className={`grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_150px_170px_170px_150px] ${
                  feedback?.notice === "donation-tier-updated" && feedback?.channel === tier.id
                    ? "bg-emerald-50/60"
                    : ""
                }`}
                key={tier.id}
              >
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/contribution-pricing?channel=${tier.id}`} />
                <input name="tier_id" type="hidden" value={tier.id} />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("contributionPricing.tierLabel")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={tier.label} name="label" required />
                  <span className="font-mono text-xs text-slate-500">{tier.code}</span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("contributionPricing.tierDescription")}
                  <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={tier.description} name="description" required />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("contributionPricing.tierPrice")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={formatDollarInput(tier.compareAtAmount ?? tier.amount)}
                    min="0.01"
                    name="price"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("contributionPricing.tierDiscountPercent")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={getDiscountPercent(tier.amount, tier.compareAtAmount)}
                    max="99"
                    min="0"
                    name="discount_percent"
                    required
                    step="1"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("contributionPricing.status")}
                  <span className="inline-flex min-h-11 items-center justify-between rounded-md border border-slate-300 px-3">
                    <span className="text-sm text-slate-700">{tier.isActive ? t("contributionPricing.tierActive") : t("contributionPricing.tierInactive")}</span>
                    <span className={`relative ml-3 inline-flex h-6 w-11 items-center rounded-full transition-colors ${tier.isActive ? "bg-slate-950" : "bg-slate-300"}`}>
                      <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${tier.isActive ? "translate-x-5" : "translate-x-0"}`} />
                      <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={tier.isActive} name="is_active" type="checkbox" />
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{t("contributionPricing.tierStatusHelp")}</span>
                </label>
                <div className="flex items-end">
                  <div className="flex w-full flex-col gap-2">
                    <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
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
      </section>
    </AdminShell>
  );
}
