import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminDonationFilters } from "@/components/admin/admin-donation-filters";
import { AdminDonationExport } from "@/components/admin/admin-donation-export";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addManualDonation } from "../actions";

type AdminDonationsPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    page?: string;
    query?: string;
    provider?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
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
  const { locale: localeParam } = await params;
  const searchParamsState = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/donations`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/donations");

  const supabase = await createSupabaseServerClient();
  const PAGE_SIZE = 20;
  const currentPage = Number(searchParamsState?.page ?? 1);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE - 1;

  let countQuery = supabase.from("donations").select("id", { count: "exact", head: true });
  let query = supabase
    .from("donations")
    .select("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at");

  const { query: searchQuery, provider, status, dateFrom, dateTo } = searchParamsState ?? {};

  if (searchQuery) {
    countQuery = countQuery.ilike("provider_transaction_id", `%${searchQuery}%`);
    query = query.ilike("provider_transaction_id", `%${searchQuery}%`);
  }
  if (provider === "stripe" || provider === "paypal" || provider === "manual" || provider === "dodo") {
    countQuery = countQuery.eq("provider", provider);
    query = query.eq("provider", provider);
  }
  if (status === "pending" || status === "paid" || status === "cancelled" || status === "failed" || status === "refunded") {
    countQuery = countQuery.eq("status", status);
    query = query.eq("status", status);
  }
  if (dateFrom) {
    countQuery = countQuery.gte("created_at", new Date(dateFrom).toISOString());
    query = query.gte("created_at", new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    countQuery = countQuery.lte("created_at", new Date(dateTo).toISOString());
    query = query.lte("created_at", new Date(dateTo).toISOString());
  }

  const [{ count: totalCount }, { data: donations, error }] = await Promise.all([
    countQuery,
    query.order("created_at", { ascending: false }).range(startIndex, endIndex),
  ]);

  if (error) {
    throw error;
  }

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 1;

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
          <AdminFeedbackBanner error={searchParamsState?.error} notice={searchParamsState?.notice} />
          <AdminDonationFilters
            actionPath="/admin/donations"
            labels={{
              allProviders: t("donations.filter.allProviders"),
              allStatuses: t("donations.filter.allStatuses"),
              apply: t("donations.filter.apply"),
              dateFrom: t("donations.filter.dateFrom"),
              dateTo: t("donations.filter.dateTo"),
              moreFilters: t("donations.filter.moreFilters"),
              reset: t("donations.filter.reset"),
              search: t("donations.filter.search"),
              searchPlaceholder: t("donations.filter.searchPlaceholder"),
              status: t("donations.filter.status"),
              provider: t("donations.filter.provider"),
            }}
            values={{
              dateFrom,
              dateTo,
              query: searchQuery,
              provider,
              status,
            }}
          />
          <div className="mt-4 flex justify-end">
            <AdminDonationExport
              donations={donations ?? []}
              locale={locale}
              labels={{
                export: t("donations.export"),
                exporting: t("donations.exporting"),
              }}
              providerLabels={{
                stripe: t("donations.providers.stripe"),
                paypal: t("donations.providers.paypal"),
                manual: t("donations.providers.manual"),
                dodo: t("donations.providers.dodo"),
              }}
              statusLabels={{
                pending: t("donations.statuses.pending"),
                paid: t("donations.statuses.paid"),
                cancelled: t("donations.statuses.cancelled"),
                failed: t("donations.statuses.failed"),
                refunded: t("donations.statuses.refunded"),
              }}
            />
          </div>
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
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  name="user_identifier"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.amountCents")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  min="1"
                  name="amount"
                  required
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.reference")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  maxLength={120}
                  name="reference"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("donations.reason")}
                <input
                  className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
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
              <>
                <AdminTableShell
                label={t("donations.title")}
                mobileCards={
                  <div className="grid gap-3">
                    {donations.map((donation) => (
                      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={donation.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {t(`donations.providers.${donation.provider as DonationProvider}`)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">{formatAmount(donation.amount, donation.currency, locale)}</p>
                          </div>
                          <AdminStatusBadge tone={getDonationStatusTone(donation.status as DonationStatus)}>
                            {t(`donations.statuses.${donation.status as DonationStatus}`)}
                          </AdminStatusBadge>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("donations.paidAt")}</dt>
                            <dd className="text-right text-slate-900">{formatDateTimeWithSeconds(donation.paid_at ?? donation.created_at, locale)}</dd>
                          </div>
                          <div className="grid gap-1">
                            <dt className="text-slate-500">{t("donations.transactionId")}</dt>
                            <dd className="break-all font-mono text-xs text-slate-900">{donation.provider_transaction_id}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                }
              >
                <table aria-label={t("donations.title")} className="min-w-[1040px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[180px]" />
                    <col className="w-[150px]" />
                    <col className="w-[170px]" />
                    <col className="w-[240px]" />
                    <col className="w-[300px]" />
                  </colgroup>
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
                        <td className="px-5 py-4 font-mono text-xs text-slate-700">
                          <span className="block break-all">{donation.provider_transaction_id}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
              <AdminPagination
                basePath="/admin/donations"
                currentPage={currentPage}
                totalPages={totalPages}
                labels={{
                  previous: t("pagination.previous"),
                  next: t("pagination.next"),
                  page: t("pagination.page"),
                  of: t("pagination.of"),
                }}
              />
              </>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("donations.empty")}</p>
            )}
          </AdminCard>
      </section>
    </AdminShell>
  );
}
