import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminDonationsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function formatAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default async function AdminDonationsPage({ params }: AdminDonationsPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);

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
            <p className="text-sm font-medium text-slate-600">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Admin donations</h1>
          </div>
          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            {donations && donations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Provider</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {donations.map((donation) => (
                      <tr key={donation.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-950">{donation.provider}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{donation.status}</td>
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
              <p className="px-5 py-6 text-sm text-slate-600">No donations found.</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
