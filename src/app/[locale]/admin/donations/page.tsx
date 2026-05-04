import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addManualDonation } from "../actions";

type AdminDonationsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

type DonationStatus = "pending" | "paid" | "cancelled" | "failed" | "refunded";
type DonationProvider = "stripe" | "paypal" | "manual" | "dodo";

function formatAmount(amount: number, currency: string, locale: string) {
  const currencyCode = currency.toUpperCase();
  const formattedAmount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount / 100);

  return `${formattedAmount} ${currencyCode}`;
}

function getDonationStatusTone(status: DonationStatus) {
  if (status === "paid") return "success";
  if (status === "failed" || status === "refunded") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}

export default async function AdminDonationsPage({ params, searchParams }: AdminDonationsPageProps) {
  const { locale } = await params;
  const feedback = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/donations");

  const supabase = await createSupabaseServerClient();
  const { data: donations, error } = await supabase
    .from("donations")
    .select("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
          <AdminPageHeader
            backHref="/admin"
            backLabel={t("shell.backToAdmin")}
            description={t("donations.description")}
            eyebrow={t("donations.eyebrow")}
            title={t("donations.title")}
          />
          <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />
          <AdminCard className="p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t("donations.manualEntryTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("donations.manualEntryDescription")}</p>
            </div>
            <form action={addManualDonation} className="mt-4 grid gap-3 md:grid-cols-[1fr_11rem_1fr_1fr_auto]">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value="/admin/donations" />
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.userIdentifier")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                  name="user_identifier"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.amountCents")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                  min="1"
                  name="amount"
                  required
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.reference")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                  maxLength={120}
                  name="reference"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.reason")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                  maxLength={500}
                  name="reason"
                  required
                />
              </label>
              <ConfirmActionButton
                className="min-h-11 self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                confirmLabel={t("donations.submitManualDonation")}
                pendingLabel={t("common.processing")}
              >
                {t("donations.submitManualDonation")}
              </ConfirmActionButton>
            </form>
          </AdminCard>
          <AdminCard className="mt-6">
            {donations && donations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("donations.provider")}</th>
                      <th className="px-5 py-3">{t("donations.status")}</th>
                      <th className="px-5 py-3">{t("donations.amount")}</th>
                      <th className="px-5 py-3">{t("donations.paidAt")}</th>
                      <th className="px-5 py-3">{t("donations.transactionId")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {donations.map((donation) => (
                      <tr key={donation.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-950">
                          {t(`donations.providers.${donation.provider as DonationProvider}`)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          <AdminStatusBadge tone={getDonationStatusTone(donation.status as DonationStatus)}>
                            {t(`donations.statuses.${donation.status as DonationStatus}`)}
                          </AdminStatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatAmount(donation.amount, donation.currency, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTimeWithSeconds(donation.paid_at ?? donation.created_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {donation.provider_transaction_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("donations.empty")}</p>
            )}
          </AdminCard>
      </section>
    </AdminShell>
  );
}
