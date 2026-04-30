import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addManualDonation } from "../actions";

type AdminDonationsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type DonationStatus = "pending" | "paid" | "cancelled" | "failed" | "refunded";
type DonationProvider = "stripe" | "paypal" | "manual";

function formatAmount(amount: number, currency: string, locale: string) {
  const currencyCode = currency.toUpperCase();
  const formattedAmount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount / 100);

  return `${formattedAmount} ${currencyCode}`;
}

export default async function AdminDonationsPage({ params }: AdminDonationsPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");

  const supabase = await createSupabaseServerClient();
  const { data: donations, error } = await supabase
    .from("donations")
    .select("id,provider,status,amount,currency,provider_transaction_id")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("donations.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{t("donations.title")}</h1>
          </div>
          <section className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t("donations.manualEntryTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("donations.manualEntryDescription")}</p>
            </div>
            <form action={addManualDonation} className="mt-4 grid gap-3 md:grid-cols-[1fr_11rem_1fr_1fr_auto]">
              <input name="locale" type="hidden" value={locale} />
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
              <button
                className="min-h-11 self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                type="submit"
              >
                {t("donations.submitManualDonation")}
              </button>
            </form>
          </section>
          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            {donations && donations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("donations.provider")}</th>
                      <th className="px-5 py-3">{t("donations.status")}</th>
                      <th className="px-5 py-3">{t("donations.amount")}</th>
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
                          {t(`donations.statuses.${donation.status as DonationStatus}`)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatAmount(donation.amount, donation.currency, locale)}
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
          </section>
        </section>
      </main>
    </>
  );
}
