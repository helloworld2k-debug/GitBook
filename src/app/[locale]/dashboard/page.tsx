import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, Cloud, CreditCard, KeyRound, ShieldCheck, Sparkles, UserCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";
import { formatCertificateIssuedDate, getCertificateTypeLabel } from "@/lib/certificates/render";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  redeemDashboardTrialCode,
  updateAccountProfile,
  updateDashboardPassword,
} from "./actions";

type DashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    profile?: string;
    password?: string;
    trial?: string;
  }>;
};

type DonationStatus = "pending" | "paid" | "cancelled" | "failed" | "refunded";
type CertificateType = "donation" | "honor";

function formatDonationAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDashboardDateTime(value: string | null, locale: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusPillClass(status: DonationStatus) {
  const tone = {
    cancelled: "border-slate-400/20 bg-slate-400/10 text-slate-200",
    failed: "border-red-300/30 bg-red-400/10 text-red-100",
    paid: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    pending: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    refunded: "border-sky-300/30 bg-sky-300/10 text-sky-100",
  }[status];

  return `inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold ${tone}`;
}

function isDateInFuture(value: string | null) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function DashboardCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-panel rounded-lg ${className}`}>{children}</section>;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale } = await params;
  const statusParams = await searchParams;
  const profileStatus = statusParams?.profile;
  const passwordStatus = statusParams?.password;
  const trialStatus = statusParams?.trial;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const t = await getTranslations("dashboard");
  const certificateT = await getTranslations("certificate");
  const supabase = await createSupabaseServerClient();

  const [
    { count: donationCount, error: donationCountError },
    { count: certificateCount, error: certificateCountError },
    { data: donations, error: donationsError },
    { data: certificates, error: certificatesError },
    { data: profile, error: profileError },
    { data: entitlement, error: entitlementError },
    { data: trialRedemption, error: trialError },
  ] = await Promise.all([
    supabase.from("donations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid"),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("donations")
      .select("id,amount,currency,status,paid_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("certificates")
      .select("id,certificate_number,type,issued_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("issued_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("email,display_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("license_entitlements")
      .select("valid_until,status")
      .eq("user_id", user.id)
      .eq("feature_code", "cloud_sync")
      .eq("status", "active")
      .order("valid_until", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trial_code_redemptions")
      .select("redeemed_at,trial_valid_until,bound_at")
      .eq("user_id", user.id)
      .order("redeemed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (donationCountError) {
    throw donationCountError;
  }

  if (certificateCountError) {
    throw certificateCountError;
  }

  if (donationsError) {
    throw donationsError;
  }

  if (certificatesError) {
    throw certificatesError;
  }

  if (profileError) {
    throw profileError;
  }

  if (entitlementError) {
    throw entitlementError;
  }

  if (trialError) {
    throw trialError;
  }

  const updateProfile = updateAccountProfile.bind(null, locale);
  const updatePassword = updateDashboardPassword.bind(null, locale);
  const redeemTrial = redeemDashboardTrialCode.bind(null, locale);
  const accountLabel = profile?.display_name || profile?.email || user.email || t("memberFallback");
  const cloudSyncValidUntil = entitlement?.valid_until ?? trialRedemption?.trial_valid_until ?? null;
  const hasCloudSyncAccess = isDateInFuture(cloudSyncValidUntil);
  const trialStatusMessages = {
    duplicate: t("trial.duplicate"),
    error: t("trial.error"),
    inactive: t("trial.inactive"),
    invalid: t("trial.invalid"),
    limit: t("trial.limit"),
    saved: t("trial.saved"),
  } as const;
  const trialMessage = trialStatus && trialStatus in trialStatusMessages
    ? trialStatusMessages[trialStatus as keyof typeof trialStatusMessages]
    : null;

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <DashboardCard className="overflow-hidden p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="inline-flex min-h-8 items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100">
                      <Sparkles aria-hidden="true" className="size-4" />
                      {t("eyebrow")}
                    </p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-normal text-white sm:text-5xl">{t("title")}</h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{t("subtitle")}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-300/15 bg-slate-950/70 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                        <UserCircle aria-hidden="true" className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{accountLabel}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{profile?.email ?? user.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </DashboardCard>

              <div className="grid gap-4 sm:grid-cols-3">
                <DashboardCard className="p-5">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <CreditCard aria-hidden="true" className="size-4 text-cyan-200" />
                    {t("donations")}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-normal text-white">{donationCount ?? 0}</p>
                </DashboardCard>
                <DashboardCard className="p-5">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <BadgeCheck aria-hidden="true" className="size-4 text-violet-200" />
                    {t("certificates")}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-normal text-white">{certificateCount ?? 0}</p>
                </DashboardCard>
                <DashboardCard className="p-5">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Cloud aria-hidden="true" className="size-4 text-emerald-200" />
                    {t("cloudSync")}
                  </p>
                  <p className={`mt-4 inline-flex min-h-8 items-center rounded-md border px-3 text-sm font-semibold ${
                    hasCloudSyncAccess
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                      : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                  }`}>
                    {hasCloudSyncAccess ? t("cloudSyncActive") : t("cloudSyncInactive")}
                  </p>
                </DashboardCard>
              </div>

              <DashboardCard className="overflow-hidden">
                <div className="border-b border-cyan-300/10 px-5 py-4">
                  <h2 className="text-lg font-semibold tracking-normal text-white">{t("trial.title")}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{t("trial.description")}</p>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.55fr)]">
                  <form action={redeemTrial} className="space-y-4">
                    {trialMessage && trialStatus === "saved" ? (
                      <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">
                        {trialMessage}
                      </p>
                    ) : null}
                    {trialMessage && trialStatus !== "saved" ? (
                      <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
                        {trialMessage}
                      </p>
                    ) : null}
                    <p className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3 py-3 text-sm leading-6 text-cyan-50">
                      {t("trial.bindingHelp")}
                    </p>
                    <label className="block text-sm font-medium text-slate-100">
                      {t("trial.code")}
                      <input
                        className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-sm text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                        name="trial_code"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="neon-button inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      {t("trial.submit")}
                    </button>
                  </form>
                  <div className="rounded-md border border-cyan-300/15 bg-slate-950/70 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <ShieldCheck aria-hidden="true" className="size-4 text-cyan-200" />
                      {t("cloudSyncStatus")}
                    </p>
                    <p className="mt-4 text-sm text-slate-400">{hasCloudSyncAccess ? t("accessValidUntil") : t("accessNotActive")}</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {cloudSyncValidUntil ? formatDashboardDateTime(cloudSyncValidUntil, locale) : t("notAvailable")}
                    </p>
                    {trialRedemption?.redeemed_at ? (
                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        {t("trialRedeemedAt")} {formatDashboardDateTime(trialRedemption.redeemed_at, locale)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </DashboardCard>

              <DashboardCard className="overflow-hidden">
                <div className="border-b border-cyan-300/10 px-5 py-4">
                  <h2 className="text-lg font-semibold tracking-normal text-white">{t("recentDonations")}</h2>
                </div>
              {donations && donations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-cyan-300/5 text-xs font-semibold uppercase text-slate-400">
                      <tr>
                        <th className="px-5 py-3">{t("amount")}</th>
                        <th className="px-5 py-3">{t("status")}</th>
                        <th className="px-5 py-3">{t("date")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-300/10">
                      {donations.map((donation) => (
                        <tr key={donation.id}>
                          <td className="whitespace-nowrap px-5 py-4 font-medium text-white">
                            {formatDonationAmount(donation.amount, donation.currency, locale)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className={getStatusPillClass(donation.status as DonationStatus)}>
                              {t(`donationStatuses.${donation.status as DonationStatus}`)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-300">
                            {formatDateTimeWithSeconds(donation.paid_at ?? donation.created_at, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-400">{t("noDonations")}</p>
              )}
              </DashboardCard>

              <DashboardCard className="overflow-hidden">
                <div className="border-b border-cyan-300/10 px-5 py-4">
                  <h2 className="text-lg font-semibold tracking-normal text-white">{t("recentCertificates")}</h2>
                </div>
                {certificates && certificates.length > 0 ? (
                  <ul className="divide-y divide-cyan-300/10">
                    {certificates.map((certificate) => (
                      <li key={certificate.id} className="px-5 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{certificate.certificate_number}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {getCertificateTypeLabel(certificate.type as CertificateType, {
                                donation: certificateT("types.donation"),
                                honor: certificateT("types.honor"),
                              })}
                              {certificate.issued_at
                                ? ` - ${formatCertificateIssuedDate(
                                    certificate.issued_at,
                                    locale,
                                    certificateT("pendingIssueDate"),
                                  )}`
                                : ""}
                            </p>
                          </div>
                          <Link
                            href={`/dashboard/certificates/${certificate.id}`}
                            className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan-300/20 px-3 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                          >
                            {t("viewCertificate")}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-slate-400">{t("noCertificates")}</p>
                )}
              </DashboardCard>
            </div>

            <aside className="space-y-6">
              <DashboardCard className="overflow-hidden">
                <div className="border-b border-cyan-300/10 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-normal text-white">
                    <UserCircle aria-hidden="true" className="size-5 text-cyan-200" />
                    {t("accountTitle")}
                  </h2>
                </div>
                <form action={updateProfile} className="space-y-4 px-5 py-5">
                  {profileStatus === "saved" ? (
                    <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{t("profileSaved")}</p>
                  ) : null}
                  {profileStatus === "error" ? (
                    <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">{t("profileError")}</p>
                  ) : null}
                  <div>
                    <p className="text-sm font-medium text-slate-100">{t("email")}</p>
                    <p className="mt-2 rounded-md border border-cyan-300/15 bg-slate-950/70 px-3 py-3 text-sm text-slate-300">
                      {profile?.email ?? user.email}
                    </p>
                  </div>
                  <label className="block text-sm font-medium text-slate-100">
                    {t("displayName")}
                    <input
                      className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-sm text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                      defaultValue={profile?.display_name ?? ""}
                      maxLength={80}
                      name="display_name"
                      placeholder={t("displayNamePlaceholder")}
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    {t("saveProfile")}
                  </button>
                </form>
              </DashboardCard>

              <DashboardCard className="overflow-hidden">
                <div className="border-b border-cyan-300/10 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-normal text-white">
                    <KeyRound aria-hidden="true" className="size-5 text-violet-200" />
                    {t("passwordTitle")}
                  </h2>
                </div>
                <form action={updatePassword} className="space-y-4 px-5 py-5">
                  {passwordStatus === "saved" ? (
                    <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{t("passwordSaved")}</p>
                  ) : null}
                  {passwordStatus === "mismatch" ? (
                    <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">{t("passwordMismatch")}</p>
                  ) : null}
                  {passwordStatus === "error" ? (
                    <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">{t("passwordError")}</p>
                  ) : null}
                  <label className="block text-sm font-medium text-slate-100">
                    {t("newPassword")}
                    <input className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" minLength={8} name="password" required type="password" />
                  </label>
                  <label className="block text-sm font-medium text-slate-100">
                    {t("confirmPassword")}
                    <input className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" minLength={8} name="confirm_password" required type="password" />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-violet-300/20 bg-violet-300/10 px-4 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                  >
                    {t("savePassword")}
                  </button>
                </form>
              </DashboardCard>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
