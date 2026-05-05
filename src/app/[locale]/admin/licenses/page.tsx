import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { TrialCodeRevealButton } from "@/components/admin/trial-code-reveal-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createTrialCode,
  deleteTrialCode,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
  updateTrialCode,
} from "../actions";

type AdminLicensesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null, locale: string, fallback: string) {
  return value ? formatDateTime(value, locale) : fallback;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

export default async function AdminLicensesPage({ params, searchParams }: AdminLicensesPageProps) {
  const { locale } = await params;
  const feedback = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/licenses");
  const supabase = createSupabaseAdminClient();

  const [trialCodesResult, deletedTrialCodesResult, trialRedemptionsResult, entitlementsResult, sessionsResult, leasesResult] = await Promise.all([
    supabase
      .from("trial_codes")
      .select("id,label,trial_days,duration_kind,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by")
      .is("deleted_at", null)
      .eq("duration_kind", "trial_3_day")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("trial_codes")
      .select("id,label,trial_days,duration_kind,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by")
      .not("deleted_at", "is", null)
      .eq("duration_kind", "trial_3_day")
      .order("deleted_at", { ascending: false })
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

  if (deletedTrialCodesResult.error) {
    throw deletedTrialCodesResult.error;
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
  const deletedTrialCodes = deletedTrialCodesResult.data ?? [];
  const trialRedemptions = trialRedemptionsResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const leases = leasesResult.data ?? [];

  return (
    <AdminShell {...shellProps}>
        <section className="mx-auto max-w-7xl">
          <AdminPageHeader
            backHref="/admin"
            backLabel={t("shell.backToAdmin")}
            description={t("licenses.description")}
            eyebrow={t("licenses.eyebrow")}
            title={t("licenses.title")}
          />
          <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

          <AdminCard className="p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.createTrialTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t("licenses.createTrialDescription")}</p>
            </div>
            <form action={createTrialCode} className="mt-4 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value="/admin/licenses" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.label")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    maxLength={120}
                    name="label"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("licenses.trialDays")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    defaultValue="3"
                    max="7"
                    min="1"
                    name="trial_days"
                    required
                    type="number"
                  />
                </label>
              </div>
              <AdminSubmitButton
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:w-fit"
                pendingLabel={t("common.processing")}
              >
                {t("licenses.createTrial")}
              </AdminSubmitButton>
            </form>
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.trialCodesTitle")}</h2>
            </div>
            {trialCodes.length > 0 ? (
              <AdminTableShell label={t("licenses.trialCodesTitle")}>
                <table aria-label={t("licenses.trialCodesTitle")} className="min-w-[1540px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[340px]" />
                    <col className="w-[260px]" />
                    <col className="w-[120px]" />
                    <col className="w-[240px]" />
                    <col className="w-[150px]" />
                    <col className="w-[130px]" />
                    <col className="w-[300px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.label")}</th>
                      <th className="px-5 py-3">{t("licenses.code")}</th>
                      <th className="px-5 py-3">{t("licenses.duration")}</th>
                      <th className="px-5 py-3">{t("licenses.generatedAt")}</th>
                      <th className="px-5 py-3">{t("licenses.redemptions")}</th>
                      <th className="px-5 py-3">{t("licenses.status")}</th>
                      <th className="sticky right-0 z-10 w-[300px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trialCodes.map((trialCode) => (
                      <tr key={trialCode.id}>
                        <td className="px-5 py-4 align-top">
                          <form action={updateTrialCode} className="grid gap-3">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value="/admin/licenses" />
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
                            <label className="grid gap-1 text-xs font-medium text-slate-600">
                              {t("licenses.trialDays")}
                              <input
                                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                                defaultValue={trialCode.trial_days}
                                max="7"
                                min="1"
                                name="trial_days"
                                required
                                type="number"
                              />
                            </label>
                            <AdminSubmitButton
                              className="inline-flex min-h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                              pendingLabel={t("common.saving")}
                            >
                              {t("licenses.save")}
                            </AdminSubmitButton>
                          </form>
                        </td>
                        <td className="px-5 py-4 align-top font-mono text-xs text-slate-700">
                          <div className="grid gap-2">
                            <span className="break-all">{trialCode.code_mask ?? "-"}</span>
                            <p className="font-sans text-xs leading-5 text-slate-500">{t("licenses.revealHelp")}</p>
                            <TrialCodeRevealButton
                              errorLabel={t("licenses.revealError")}
                              hideLabel={t("licenses.hide")}
                              locale={locale}
                              revealLabel={t("licenses.reveal")}
                              trialCodeId={trialCode.id}
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">
                          {trialCode.trial_days} {t("licenses.days")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">
                          {formatDateTime(trialCode.created_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">
                          {trialCode.redemption_count} / {trialCode.max_redemptions ?? t("licenses.unlimited")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">
                          <AdminStatusBadge tone={trialCode.is_active ? "success" : "neutral"}>
                            {trialCode.is_active ? t("licenses.active") : t("licenses.inactive")}
                          </AdminStatusBadge>
                        </td>
                        <td className="sticky right-0 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          <div className="flex min-w-[260px] flex-wrap justify-end gap-2" data-testid={`trial-code-actions-${trialCode.id}`}>
                            <form action={setTrialCodeActive}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/licenses" />
                              <input name="trial_code_id" type="hidden" value={trialCode.id} />
                              <input name="is_active" type="hidden" value={trialCode.is_active ? "false" : "true"} />
                              <AdminSubmitButton
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                pendingLabel={t("common.processing")}
                              >
                                {trialCode.is_active ? t("licenses.deactivate") : t("licenses.activate")}
                              </AdminSubmitButton>
                            </form>
                            <form action={deleteTrialCode}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/licenses" />
                              <input name="trial_code_id" type="hidden" value={trialCode.id} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition-colors hover:border-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                                confirmLabel={t("licenses.delete")}
                                pendingLabel={t("common.processing")}
                              >
                                {t("licenses.delete")}
                              </ConfirmActionButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyTrialCodes")}</p>
            )}
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.deletedTrialCodesTitle")}</h2>
            </div>
            {deletedTrialCodes.length > 0 ? (
              <AdminTableShell label={t("licenses.deletedTrialCodesTitle")}>
                <table aria-label={t("licenses.deletedTrialCodesTitle")} className="min-w-[1120px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[260px]" />
                    <col className="w-[240px]" />
                    <col className="w-[120px]" />
                    <col className="w-[160px]" />
                    <col className="w-[220px]" />
                    <col className="w-[180px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.label")}</th>
                      <th className="px-5 py-3">{t("licenses.code")}</th>
                      <th className="px-5 py-3">{t("licenses.duration")}</th>
                      <th className="px-5 py-3">{t("licenses.generatedAt")}</th>
                      <th className="px-5 py-3">{t("licenses.deletedAt")}</th>
                      <th className="px-5 py-3">{t("licenses.deletedBy")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deletedTrialCodes.map((trialCode) => (
                      <tr key={trialCode.id}>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-950">{trialCode.label}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{trialCode.code_mask ?? "-"}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {trialCode.trial_days} {t("licenses.days")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(trialCode.created_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatOptionalDateTime(trialCode.deleted_at, locale, "-")}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {trialCode.updated_by ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyDeletedTrialCodes")}</p>
            )}
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.trialRedemptionsTitle")}</h2>
            </div>
            {trialRedemptions.length > 0 ? (
              <AdminTableShell label={t("licenses.trialRedemptionsTitle")}>
                <table aria-label={t("licenses.trialRedemptionsTitle")} className="min-w-[1120px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                    <col className="w-[200px]" />
                    <col className="w-[200px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.redeemedAt")}</th>
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
                          {formatDateTime(redemption.redeemed_at, locale)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          <AdminStatusBadge tone={redemption.bound_at ? "success" : "warning"}>
                            {redemption.bound_at ? t("licenses.bound") : t("licenses.unbound")}
                          </AdminStatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(redemption.trial_valid_until, locale)}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <span className="block break-all">{redemption.device_id ?? "-"}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">
                          {shortHash(redemption.machine_code_hash)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyTrialRedemptions")}</p>
            )}
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.entitlementsTitle")}</h2>
            </div>
            {entitlements.length > 0 ? (
              <AdminTableShell label={t("licenses.entitlementsTitle")}>
                <table aria-label={t("licenses.entitlementsTitle")} className="min-w-[980px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[140px]" />
                    <col className="w-[240px]" />
                    <col className="w-[240px]" />
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                  </colgroup>
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
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyEntitlements")}</p>
            )}
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.desktopSessionsTitle")}</h2>
            </div>
            {sessions.length > 0 ? (
              <AdminTableShell label={t("licenses.desktopSessionsTitle")}>
                <table aria-label={t("licenses.desktopSessionsTitle")} className="min-w-[1480px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[140px]" />
                    <col className="w-[140px]" />
                    <col className="w-[200px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.device")}</th>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.platform")}</th>
                      <th className="px-5 py-3">{t("licenses.machine")}</th>
                      <th className="px-5 py-3">{t("licenses.lastSeen")}</th>
                      <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                      <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                      <th className="sticky right-0 z-10 w-[220px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td className="px-5 py-4 text-slate-950">
                          <span className="block break-all font-medium">{session.device_id}</span>
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
                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          {session.revoked_at ? null : (
                            <form action={revokeDesktopSession}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/licenses" />
                              <input name="desktop_session_id" type="hidden" value={session.id} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                confirmLabel={t("licenses.revoke")}
                                pendingLabel={t("common.processing")}
                              >
                                {t("licenses.revoke")}
                              </ConfirmActionButton>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptySessions")}</p>
            )}
          </AdminCard>

          <AdminCard className="mt-6">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("licenses.cloudSyncLeasesTitle")}</h2>
            </div>
            {leases.length > 0 ? (
              <AdminTableShell label={t("licenses.cloudSyncLeasesTitle")}>
                <table aria-label={t("licenses.cloudSyncLeasesTitle")} className="min-w-[1460px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[240px]" />
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("licenses.device")}</th>
                      <th className="px-5 py-3">{t("licenses.user")}</th>
                      <th className="px-5 py-3">{t("licenses.session")}</th>
                      <th className="px-5 py-3">{t("licenses.lastHeartbeat")}</th>
                      <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                      <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                      <th className="sticky right-0 z-10 w-[220px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leases.map((lease) => (
                      <tr key={lease.id}>
                        <td className="px-5 py-4 font-medium text-slate-950">
                          <span className="block break-all">{lease.device_id}</span>
                        </td>
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
                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          {lease.revoked_at ? null : (
                            <form action={revokeCloudSyncLease}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/licenses" />
                              <input name="cloud_sync_lease_id" type="hidden" value={lease.id} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                                confirmLabel={t("licenses.revoke")}
                                pendingLabel={t("common.processing")}
                              >
                                {t("licenses.revoke")}
                              </ConfirmActionButton>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyLeases")}</p>
            )}
          </AdminCard>
        </section>
    </AdminShell>
  );
}
