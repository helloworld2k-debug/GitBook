import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createTrialCode,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
  updateTrialCode,
} from "../actions";

type AdminLicensesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null, locale: string, fallback: string) {
  return value ? formatDateTime(value, locale) : fallback;
}

function formatDateTimeInput(value: string) {
  return value.slice(0, 16);
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

export default async function AdminLicensesPage({ params }: AdminLicensesPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const supabase = createSupabaseAdminClient();

  const [trialCodesResult, trialRedemptionsResult, entitlementsResult, sessionsResult, leasesResult] = await Promise.all([
    supabase
      .from("trial_codes")
      .select("id,label,trial_days,starts_at,ends_at,max_redemptions,redemption_count,is_active,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("trial_code_redemptions")
      .select("id,user_id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at")
      .order("redeemed_at", { ascending: false })
      .limit(50),
    supabase
      .from("license_entitlements")
      .select("id,user_id,feature_code,valid_until,status,source_donation_id,updated_at")
      .order("valid_until", { ascending: false })
      .limit(50),
    supabase
      .from("desktop_sessions")
      .select("id,user_id,device_id,machine_code_hash,platform,app_version,last_seen_at,cloud_sync_active_until,expires_at,revoked_at")
      .order("last_seen_at", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_leases")
      .select("id,user_id,desktop_session_id,device_id,last_heartbeat_at,expires_at,revoked_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  if (trialCodesResult.error) {
    throw trialCodesResult.error;
  }

  if (entitlementsResult.error) {
    throw entitlementsResult.error;
  }

  if (trialRedemptionsResult.error) {
    throw trialRedemptionsResult.error;
  }

  if (sessionsResult.error) {
    throw sessionsResult.error;
  }

  if (leasesResult.error) {
    throw leasesResult.error;
  }

  const trialCodes = trialCodesResult.data ?? [];
  const trialRedemptions = trialRedemptionsResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const leases = leasesResult.data ?? [];

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("licenses.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{t("licenses.title")}</h1>
          </div>

          <section className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.createTrialTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("licenses.createTrialDescription")}</p>
            </div>
            <form action={createTrialCode} className="mt-4 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.code")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    name="code"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.label")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    maxLength={120}
                    name="label"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.trialDays")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    defaultValue="3"
                    max="365"
                    min="1"
                    name="trial_days"
                    required
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.maxRedemptions")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    min="1"
                    name="max_redemptions"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.startsAt")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    name="starts_at"
                    required
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.endsAt")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    name="ends_at"
                    required
                    type="datetime-local"
                  />
                </label>
              </div>
              <button
                className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                type="submit"
              >
                {t("licenses.createTrial")}
              </button>
            </form>
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.trialCodesTitle")}</h2>
            </div>
            {trialCodes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.label")}</th>
                      <th className="px-5 py-3">{t("licenses.period")}</th>
                      <th className="px-5 py-3">{t("licenses.redemptions")}</th>
                      <th className="px-5 py-3">{t("licenses.status")}</th>
                      <th className="px-5 py-3">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trialCodes.map((trialCode) => (
                      <tr key={trialCode.id}>
                        <td className="min-w-72 px-5 py-4 align-top">
                          <form action={updateTrialCode} className="grid gap-3">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="trial_code_id" type="hidden" value={trialCode.id} />
                            <label className="grid gap-1 text-xs font-medium text-slate-600">
                              {t("licenses.label")}
                              <input
                                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                defaultValue={trialCode.label}
                                maxLength={120}
                                name="label"
                                required
                              />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1 text-xs font-medium text-slate-600">
                                {t("licenses.trialDays")}
                                <input
                                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                  defaultValue={trialCode.trial_days}
                                  max="365"
                                  min="1"
                                  name="trial_days"
                                  required
                                  type="number"
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-medium text-slate-600">
                                {t("licenses.maxRedemptions")}
                                <input
                                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                  defaultValue={trialCode.max_redemptions ?? ""}
                                  min="1"
                                  name="max_redemptions"
                                  type="number"
                                />
                              </label>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1 text-xs font-medium text-slate-600">
                                {t("licenses.startsAt")}
                                <input
                                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                  defaultValue={formatDateTimeInput(trialCode.starts_at)}
                                  name="starts_at"
                                  required
                                  type="datetime-local"
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-medium text-slate-600">
                                {t("licenses.endsAt")}
                                <input
                                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                  defaultValue={formatDateTimeInput(trialCode.ends_at)}
                                  name="ends_at"
                                  required
                                  type="datetime-local"
                                />
                              </label>
                            </div>
                            <button
                              className="inline-flex min-h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                              type="submit"
                            >
                              {t("licenses.save")}
                            </button>
                          </form>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          <span className="block">{formatDateTime(trialCode.starts_at, locale)}</span>
                          <span className="block">{formatDateTime(trialCode.ends_at, locale)}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {trialCode.redemption_count} / {trialCode.max_redemptions ?? t("licenses.unlimited")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {trialCode.is_active ? t("licenses.active") : t("licenses.inactive")}
                        </td>
                        <td className="px-5 py-4">
                          <form action={setTrialCodeActive}>
                            <input name="locale" type="hidden" value={locale} />
                            <input name="trial_code_id" type="hidden" value={trialCode.id} />
                            <input name="is_active" type="hidden" value={trialCode.is_active ? "false" : "true"} />
                            <button
                              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                              type="submit"
                            >
                              {trialCode.is_active ? t("licenses.deactivate") : t("licenses.activate")}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyTrialCodes")}</p>
            )}
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.trialRedemptionsTitle")}</h2>
            </div>
            {trialRedemptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.status")}</th>
                      <th className="px-5 py-3">{t("licenses.validUntil")}</th>
                      <th className="px-5 py-3">{t("licenses.device")}</th>
                      <th className="px-5 py-3">{t("licenses.machine")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trialRedemptions.map((redemption) => (
                      <tr key={redemption.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">
                          {shortId(redemption.user_id)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {redemption.bound_at ? t("licenses.bound") : t("licenses.unbound")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(redemption.trial_valid_until, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{redemption.device_id ?? "-"}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortHash(redemption.machine_code_hash)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyTrialRedemptions")}</p>
            )}
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.entitlementsTitle")}</h2>
            </div>
            {entitlements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.feature")}</th>
                      <th className="px-5 py-3">{t("licenses.validUntil")}</th>
                      <th className="px-5 py-3">{t("licenses.status")}</th>
                      <th className="px-5 py-3">{t("licenses.sourceDonation")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {entitlements.map((entitlement) => (
                      <tr key={entitlement.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">
                          {shortId(entitlement.user_id)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{entitlement.feature_code}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(entitlement.valid_until, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{entitlement.status}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {entitlement.source_donation_id ? shortId(entitlement.source_donation_id) : t("licenses.none")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyEntitlements")}</p>
            )}
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.desktopSessionsTitle")}</h2>
            </div>
            {sessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.device")}</th>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.platform")}</th>
                      <th className="px-5 py-3">{t("licenses.machine")}</th>
                      <th className="px-5 py-3">{t("licenses.lastSeen")}</th>
                      <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                      <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                      <th className="px-5 py-3">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-950">
                          <span className="block font-medium">{session.device_id}</span>
                          {session.app_version ? <span className="block text-xs text-slate-500">{session.app_version}</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortId(session.user_id)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{session.platform}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortHash(session.machine_code_hash)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(session.last_seen_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(session.expires_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatOptionalDateTime(session.revoked_at, locale, t("licenses.notRevoked"))}
                        </td>
                        <td className="px-5 py-4">
                          {session.revoked_at ? null : (
                            <form action={revokeDesktopSession}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="desktop_session_id" type="hidden" value={session.id} />
                              <button
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                type="submit"
                              >
                                {t("licenses.revoke")}
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptySessions")}</p>
            )}
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.cloudSyncLeasesTitle")}</h2>
            </div>
            {leases.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.device")}</th>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.session")}</th>
                      <th className="px-5 py-3">{t("licenses.lastHeartbeat")}</th>
                      <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                      <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                      <th className="px-5 py-3">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leases.map((lease) => (
                      <tr key={lease.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-950">{lease.device_id}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortId(lease.user_id)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortId(lease.desktop_session_id)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(lease.last_heartbeat_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(lease.expires_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatOptionalDateTime(lease.revoked_at, locale, t("licenses.notRevoked"))}
                        </td>
                        <td className="px-5 py-4">
                          {lease.revoked_at ? null : (
                            <form action={revokeCloudSyncLease}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="cloud_sync_lease_id" type="hidden" value={lease.id} />
                              <button
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                type="submit"
                              >
                                {t("licenses.revoke")}
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyLeases")}</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
