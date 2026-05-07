import { getTranslations } from "next-intl/server";
import { AdminLicenseBulkToolbar, AdminLicenseSelectAllCheckbox } from "@/components/admin/admin-license-bulk-toolbar";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { LicenseDurationFields } from "@/components/admin/license-duration-fields";
import { TrialCodeRevealButton } from "@/components/admin/trial-code-reveal-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  bulkUpdateLicenseCodes,
  generateLicenseCodeBatch,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
  updateCloudSyncCooldownSetting,
} from "../actions";

type AdminLicensesSearchParams = {
  channel?: string;
  createdFrom?: string;
  createdTo?: string;
  deleted?: string;
  duration?: string;
  error?: string;
  notice?: string;
  query?: string;
  redeemed?: string;
  status?: string;
};

type AdminLicensesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminLicensesSearchParams>;
};

type LicenseCodeRow = {
  id: string;
  batch_id: string | null;
  label: string;
  trial_days: number;
  duration_kind: "trial_3_day" | "month_1" | "month_3" | "year_1";
  channel_type?: "internal" | "taobao" | "xianyu" | "partner" | "other";
  channel_note?: string | null;
  code_mask: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
  updated_by: string | null;
  created_by: string | null;
};

type LicenseBatchRow = {
  id: string;
  label: string;
  channel_type: "internal" | "taobao" | "xianyu" | "partner" | "other";
  channel_note: string | null;
  duration_kind: "trial_3_day" | "month_1" | "month_3" | "year_1";
  trial_days: number;
  code_count: number;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
  updated_by: string | null;
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

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

function formatDuration(code: Pick<LicenseCodeRow, "duration_kind" | "trial_days">, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (code.duration_kind === "trial_3_day") {
    return `${code.trial_days} ${t("licenses.days")}`;
  }

  return t(`licenses.durations.${code.duration_kind}`);
}

function matchesSearch(row: { code_mask: string | null; label: string; channel_note?: string | null; id: string }, query?: string) {
  const normalized = String(query ?? "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [row.id, row.label, row.code_mask ?? "", row.channel_note ?? ""].some((value) => value.toLowerCase().includes(normalized));
}

function matchesCreatedAt(row: { created_at: string }, createdFrom?: string, createdTo?: string) {
  const value = new Date(row.created_at).getTime();
  const start = createdFrom ? new Date(createdFrom).getTime() : null;
  const end = createdTo ? new Date(`${createdTo}T23:59:59.999Z`).getTime() : null;

  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

function filterCodes(codes: LicenseCodeRow[], filters: AdminLicensesSearchParams | undefined) {
  return codes.filter((code) => {
    if (!matchesSearch(code, filters?.query)) return false;
    if (filters?.channel && (code.channel_type ?? "internal") !== filters.channel) return false;
    if (filters?.duration && code.duration_kind !== filters.duration) return false;
    if (filters?.status === "active" && !code.is_active) return false;
    if (filters?.status === "inactive" && code.is_active) return false;
    if (filters?.deleted === "deleted" && !code.deleted_at) return false;
    if (filters?.deleted === "current" && code.deleted_at) return false;
    if (filters?.redeemed === "redeemed" && code.redemption_count < 1) return false;
    if (filters?.redeemed === "unredeemed" && code.redemption_count > 0) return false;
    return matchesCreatedAt(code, filters?.createdFrom, filters?.createdTo);
  });
}

function channelLabel(channel: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  return t(`licenses.channels.${channel}`);
}

function isLicenseCodeBatchSchemaError(error: { code?: string; message?: string } | null) {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "42P01" ||
    message.includes("license_code_batches") ||
    message.includes("schema cache")
  );
}

function isLicenseCodeMetadataSchemaError(error: { code?: string; message?: string } | null) {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "PGRST204" ||
    code === "42703" ||
    message.includes("channel_type") ||
    message.includes("channel_note") ||
    message.includes("schema cache")
  );
}

export default async function AdminLicensesPage({ params, searchParams }: AdminLicensesPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/licenses`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/licenses");
  const supabase = createSupabaseAdminClient();
  const bulkFormId = "license-codes-bulk-action-form";

  const [cooldownSettingResult, batchesResult, codesResult, trialRedemptionsResult, entitlementsResult, sessionsResult, leasesResult] = await Promise.all([
    supabase.from("cloud_sync_settings").select("key,value").eq("key", "cloud_sync_device_switch_cooldown_minutes").single(),
    supabase
      .from("license_code_batches")
      .select("id,label,channel_type,channel_note,duration_kind,trial_days,code_count,created_by,created_at,deleted_at,updated_by")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("trial_codes")
      .select("id,batch_id,label,trial_days,duration_kind,channel_type,channel_note,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by,created_by")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("trial_code_redemptions")
      .select("id,user_id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at,trial_code_id")
      .order("redeemed_at", { ascending: false })
      .limit(100),
    supabase.from("license_entitlements").select("id,user_id,feature_code,valid_until,status,source_donation_id,updated_at").order("valid_until", { ascending: false }).limit(50),
    supabase.from("desktop_sessions").select("id,user_id,device_id,machine_code_hash,platform,app_version,last_seen_at,cloud_sync_active_until,expires_at,revoked_at").order("last_seen_at", { ascending: false }).limit(50),
    supabase.from("cloud_sync_leases").select("id,user_id,desktop_session_id,device_id,last_heartbeat_at,expires_at,revoked_at,updated_at").order("updated_at", { ascending: false }).limit(50),
  ]);

  if (cooldownSettingResult.error) throw cooldownSettingResult.error;
  if (batchesResult.error && !isLicenseCodeBatchSchemaError(batchesResult.error)) throw batchesResult.error;
  if (codesResult.error && !isLicenseCodeMetadataSchemaError(codesResult.error)) throw codesResult.error;
  if (trialRedemptionsResult.error) throw trialRedemptionsResult.error;
  if (entitlementsResult.error) throw entitlementsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (leasesResult.error) throw leasesResult.error;

  let fallbackCodes: LicenseCodeRow[] | null = null;

  if (codesResult.error && isLicenseCodeMetadataSchemaError(codesResult.error)) {
    const fallbackCodesResult = await supabase
      .from("trial_codes")
      .select("id,batch_id,label,trial_days,duration_kind,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by,created_by")
      .order("created_at", { ascending: false })
      .limit(300);

    if (fallbackCodesResult.error) {
      throw fallbackCodesResult.error;
    }

    fallbackCodes = ((fallbackCodesResult.data ?? []) as Omit<LicenseCodeRow, "channel_note" | "channel_type">[]).map((code) => ({
      ...code,
      channel_note: null,
      channel_type: "internal",
    }));
  }

  const batches = (batchesResult.error ? [] : (batchesResult.data ?? [])) as LicenseBatchRow[];
  const codes = fallbackCodes ?? ((codesResult.data ?? []) as LicenseCodeRow[]);
  const filteredCodes = filterCodes(codes, feedback);
  const codesByBatch = new Map<string, LicenseCodeRow[]>();
  const redemptionsByCode = new Map<string, number>();
  const cooldownMinutes = Number.parseInt(cooldownSettingResult.data?.value ?? "180", 10);
  const trialRedemptions = trialRedemptionsResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const leases = leasesResult.data ?? [];

  for (const code of codes) {
    if (!code.batch_id) continue;
    const existing = codesByBatch.get(code.batch_id) ?? [];
    existing.push(code);
    codesByBatch.set(code.batch_id, existing);
  }

  for (const redemption of trialRedemptions) {
    const key = "trial_code_id" in redemption ? String(redemption.trial_code_id ?? "") : "";
    if (!key) continue;
    redemptionsByCode.set(key, (redemptionsByCode.get(key) ?? 0) + 1);
  }

  const batchesForDisplay = batches.filter((batch) => {
    if (!matchesSearch({ id: batch.id, label: batch.label, code_mask: null, channel_note: batch.channel_note }, feedback?.query)) return false;
    if (feedback?.channel && batch.channel_type !== feedback.channel) return false;
    if (feedback?.duration && batch.duration_kind !== feedback.duration) return false;
    return matchesCreatedAt(batch, feedback?.createdFrom, feedback?.createdTo);
  });

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
            <h2 className="text-base font-semibold text-slate-950">{t("licenses.cloudSyncCooldownTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t("licenses.cloudSyncCooldownDescription")}</p>
          </div>
          <form action={updateCloudSyncCooldownSetting} className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_minmax(18rem,1fr)_auto] lg:items-end">
            <input name="locale" type="hidden" value={locale} />
            <input name="return_to" type="hidden" value="/admin/licenses" />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("licenses.cooldownMinutes")}
              <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" defaultValue={Number.isFinite(cooldownMinutes) ? cooldownMinutes : 180} max="10080" min="0" name="cooldown_minutes" required type="number" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("licenses.reason")}
              <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" name="reason" placeholder={t("licenses.cooldownReasonPlaceholder")} />
            </label>
            <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 lg:w-fit" pendingLabel={t("common.processing")}>
              {t("licenses.save")}
            </AdminSubmitButton>
          </form>
        </AdminCard>

        <AdminCard className="mt-6 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{t("licenses.batchGenerateTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t("licenses.batchGenerateDescription")}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t("licenses.fixedPaidDurationsHelp")}</p>
          </div>
          <form action={generateLicenseCodeBatch} className="mt-4 grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="return_to" type="hidden" value="/admin/licenses" />
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.label")}
                <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" maxLength={120} name="label" required />
              </label>
              <LicenseDurationFields
                labels={{
                  duration: t("licenses.duration"),
                  durationMonth1: t("licenses.durationMonth1"),
                  durationMonth3: t("licenses.durationMonth3"),
                  durationTrial: t("licenses.durationTrial"),
                  durationYear1: t("licenses.durationYear1"),
                  fixedPaidDurationsHelp: t("licenses.fixedPaidDurationsHelp"),
                  trialDays: t("licenses.trialDays"),
                }}
              />
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.quantity")}
                <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" defaultValue="1" max="10" min="1" name="quantity" required type="number" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.channel")}
                <select className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" defaultValue="internal" name="channel_type">
                  <option value="internal">{t("licenses.channels.internal")}</option>
                  <option value="taobao">{t("licenses.channels.taobao")}</option>
                  <option value="xianyu">{t("licenses.channels.xianyu")}</option>
                  <option value="partner">{t("licenses.channels.partner")}</option>
                  <option value="other">{t("licenses.channels.other")}</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.channelNote")}
                <input className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10" maxLength={500} name="channel_note" />
              </label>
            </div>
            <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:w-fit" pendingLabel={t("common.processing")}>
              {t("licenses.generateBatch")}
            </AdminSubmitButton>
          </form>
        </AdminCard>

        <form action={`/${locale}/admin/licenses`} className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licenses.search")}
            <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.query ?? ""} name="query" placeholder={t("licenses.searchPlaceholder")} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licenses.channel")}
            <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.channel ?? ""} name="channel">
              <option value="">{t("licenses.allChannels")}</option>
              <option value="internal">{t("licenses.channels.internal")}</option>
              <option value="taobao">{t("licenses.channels.taobao")}</option>
              <option value="xianyu">{t("licenses.channels.xianyu")}</option>
              <option value="partner">{t("licenses.channels.partner")}</option>
              <option value="other">{t("licenses.channels.other")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licenses.duration")}
            <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.duration ?? ""} name="duration">
              <option value="">{t("licenses.allDurations")}</option>
              <option value="trial_3_day">{t("licenses.durationTrial")}</option>
              <option value="month_1">{t("licenses.durationMonth1")}</option>
              <option value="month_3">{t("licenses.durationMonth3")}</option>
              <option value="year_1">{t("licenses.durationYear1")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licenses.status")}
            <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.status ?? ""} name="status">
              <option value="">{t("licenses.allStatuses")}</option>
              <option value="active">{t("licenses.active")}</option>
              <option value="inactive">{t("licenses.inactive")}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {t("licenses.redemptions")}
            <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.redeemed ?? ""} name="redeemed">
              <option value="">{t("licenses.allRedemptions")}</option>
              <option value="redeemed">{t("licenses.redeemed")}</option>
              <option value="unredeemed">{t("licenses.unredeemed")}</option>
            </select>
          </label>
          <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 lg:col-span-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">{t("licenses.moreFilters")}</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.deleted")}
                <select className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.deleted ?? "current"} name="deleted">
                  <option value="current">{t("licenses.currentOnly")}</option>
                  <option value="deleted">{t("licenses.deletedOnly")}</option>
                  <option value="">{t("licenses.currentAndDeleted")}</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.createdFrom")}
                <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.createdFrom ?? ""} name="createdFrom" type="date" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("licenses.createdTo")}
                <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={feedback?.createdTo ?? ""} name="createdTo" type="date" />
              </label>
            </div>
          </details>
          <div className="flex flex-wrap gap-3 lg:col-span-5">
            <button className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">{t("licenses.applyFilters")}</button>
            <a className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href={`/${locale}/admin/licenses`}>{t("licenses.resetFilters")}</a>
          </div>
        </form>

        <AdminCard className="mt-6">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("licenses.batchesTitle")}</h2>
          </div>
          {batchesForDisplay.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {batchesForDisplay.map((batch) => {
                const batchCodes = codesByBatch.get(batch.id) ?? [];
                const activeCount = batchCodes.filter((code) => code.is_active && !code.deleted_at).length;
                const redeemedCount = batchCodes.reduce((total, code) => total + code.redemption_count, 0);

                return (
                  <details className="group" key={batch.id}>
                    <summary className="grid cursor-pointer list-none gap-4 px-5 py-4 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr]">
                      <div>
                        <p className="font-semibold text-slate-950">{batch.label}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{shortId(batch.id)}</p>
                        {batch.channel_note ? <p className="mt-1 text-xs text-slate-500">{batch.channel_note}</p> : null}
                      </div>
                      <div className="text-sm text-slate-700">{channelLabel(batch.channel_type, t)}</div>
                      <div className="text-sm text-slate-700">{formatDuration(batch, t)}</div>
                      <div className="text-sm text-slate-700">{activeCount} / {batch.code_count} {t("licenses.active")}</div>
                      <div className="text-sm text-slate-700">{redeemedCount} {t("licenses.redeemed")}</div>
                    </summary>
                    <div className="px-5 pb-5">
                      <p className="mb-3 text-xs text-slate-500">
                        {t("licenses.generatedAt")}: {formatDateTime(batch.created_at, locale)} · {t("licenses.generatedBy")}: {shortId(batch.created_by)}
                      </p>
                      <div className="overflow-x-auto rounded-md border border-slate-200">
                        <table className="min-w-[980px] table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-[220px]" />
                            <col className="w-[120px]" />
                            <col className="w-[140px]" />
                            <col className="w-[120px]" />
                            <col className="w-[260px]" />
                          </colgroup>
                          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                            <tr>
                              <th className="px-4 py-3">{t("licenses.code")}</th>
                              <th className="px-4 py-3">{t("licenses.status")}</th>
                              <th className="px-4 py-3">{t("licenses.redemptions")}</th>
                              <th className="px-4 py-3">{t("licenses.duration")}</th>
                              <th className="px-4 py-3">{t("licenses.action")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {batchCodes.map((code) => (
                              <tr key={code.id}>
                                <td className="break-all px-4 py-3 font-mono text-xs text-slate-700">{code.code_mask ?? "-"}</td>
                                <td className="px-4 py-3">
                                  <AdminStatusBadge tone={code.deleted_at ? "warning" : code.is_active ? "success" : "neutral"}>
                                    {code.deleted_at ? t("licenses.deleted") : code.is_active ? t("licenses.active") : t("licenses.inactive")}
                                  </AdminStatusBadge>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{code.redemption_count} / {code.max_redemptions ?? t("licenses.unlimited")}</td>
                                <td className="px-4 py-3 text-slate-700">{formatDuration(code, t)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    <TrialCodeRevealButton errorLabel={t("licenses.revealError")} hideLabel={t("licenses.hide")} locale={locale} revealLabel={t("licenses.reveal")} trialCodeId={code.id} />
                                    <form action={setTrialCodeActive}>
                                      <input name="locale" type="hidden" value={locale} />
                                      <input name="return_to" type="hidden" value="/admin/licenses" />
                                      <input name="trial_code_id" type="hidden" value={code.id} />
                                      <input name="is_active" type="hidden" value={code.is_active ? "false" : "true"} />
                                      <AdminSubmitButton className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={t("common.processing")}>
                                        {code.is_active ? t("licenses.deactivate") : t("licenses.activate")}
                                      </AdminSubmitButton>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyBatches")}</p>
          )}
        </AdminCard>

        <AdminLicenseBulkToolbar
          formId={bulkFormId}
          labels={{
            activate: t("licenses.activate"),
            applyMetadata: t("licenses.applyMetadata"),
            channel: t("licenses.channel"),
            channelNote: t("licenses.channelNote"),
            clearSelection: t("licenses.clearSelection"),
            deactivate: t("licenses.deactivate"),
            delete: t("licenses.delete"),
            internal: t("licenses.channels.internal"),
            other: t("licenses.channels.other"),
            partner: t("licenses.channels.partner"),
            selectedCount: t("licenses.selectedCount", { count: "__COUNT__" }),
            taobao: t("licenses.channels.taobao"),
            xianyu: t("licenses.channels.xianyu"),
          }}
        />

        <form action={bulkUpdateLicenseCodes} className="hidden" id={bulkFormId}>
          <input name="locale" type="hidden" value={locale} />
          <input name="return_to" type="hidden" value="/admin/licenses" />
        </form>

        <AdminCard className="mt-6">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("licenses.licenseCodesTitle")}</h2>
          </div>
          {filteredCodes.length > 0 ? (
            <AdminTableShell label={t("licenses.licenseCodesTitle")}>
              <table aria-label={t("licenses.licenseCodesTitle")} className="min-w-[1560px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[56px]" />
                  <col className="w-[260px]" />
                  <col className="w-[220px]" />
                  <col className="w-[140px]" />
                  <col className="w-[140px]" />
                  <col className="w-[140px]" />
                  <col className="w-[180px]" />
                  <col className="w-[180px]" />
                  <col className="w-[240px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3"><AdminLicenseSelectAllCheckbox formId={bulkFormId} label={t("licenses.selectAll")} /></th>
                    <th className="px-5 py-3">{t("licenses.label")}</th>
                    <th className="px-5 py-3">{t("licenses.code")}</th>
                    <th className="px-5 py-3">{t("licenses.duration")}</th>
                    <th className="px-5 py-3">{t("licenses.channel")}</th>
                    <th className="px-5 py-3">{t("licenses.status")}</th>
                    <th className="px-5 py-3">{t("licenses.redemptions")}</th>
                    <th className="px-5 py-3">{t("licenses.generatedAt")}</th>
                    <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="px-5 py-4 align-top">
                        <input className="size-4 rounded border-slate-300" form={bulkFormId} name="license_code_ids" type="checkbox" value={code.id} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-slate-950">{code.label}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{shortId(code.batch_id)}</p>
                      </td>
                      <td className="break-all px-5 py-4 align-top font-mono text-xs text-slate-700">{code.code_mask ?? "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{formatDuration(code, t)}</td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        <span className="block">{channelLabel(code.channel_type ?? "internal", t)}</span>
                        {code.channel_note ? <span className="mt-1 block text-xs text-slate-500">{code.channel_note}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        <AdminStatusBadge tone={code.deleted_at ? "warning" : code.is_active ? "success" : "neutral"}>
                          {code.deleted_at ? t("licenses.deleted") : code.is_active ? t("licenses.active") : t("licenses.inactive")}
                        </AdminStatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{code.redemption_count} / {code.max_redemptions ?? t("licenses.unlimited")}</td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{formatDateTime(code.created_at, locale)}</td>
                      <td className="sticky right-0 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                        <div className="flex flex-wrap justify-end gap-2">
                          <TrialCodeRevealButton errorLabel={t("licenses.revealError")} hideLabel={t("licenses.hide")} locale={locale} revealLabel={t("licenses.reveal")} trialCodeId={code.id} />
                          <form action={setTrialCodeActive}>
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value="/admin/licenses" />
                            <input name="trial_code_id" type="hidden" value={code.id} />
                            <input name="is_active" type="hidden" value={code.is_active ? "false" : "true"} />
                            <AdminSubmitButton className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={t("common.processing")}>
                              {code.is_active ? t("licenses.deactivate") : t("licenses.activate")}
                            </AdminSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("licenses.emptyLicenseCodes")}</p>
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
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">{shortId(redemption.user_id)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(redemption.redeemed_at, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        <AdminStatusBadge tone={redemption.bound_at ? "success" : "warning"}>{redemption.bound_at ? t("licenses.bound") : t("licenses.unbound")}</AdminStatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(redemption.trial_valid_until, locale)}</td>
                      <td className="px-5 py-4 text-slate-700"><span className="block break-all">{redemption.device_id ?? "-"}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{shortHash(redemption.machine_code_hash)}</td>
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
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">{shortId(entitlement.user_id)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{entitlement.feature_code}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(entitlement.valid_until, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{entitlement.status}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{entitlement.source_donation_id ? shortId(entitlement.source_donation_id) : t("licenses.none")}</td>
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
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("licenses.device")}</th>
                    <th className="px-5 py-3">{t("licenses.user")}</th>
                    <th className="px-5 py-3">{t("licenses.platform")}</th>
                    <th className="px-5 py-3">{t("licenses.machine")}</th>
                    <th className="px-5 py-3">{t("licenses.lastSeen")}</th>
                    <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                    <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                    <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td className="px-5 py-4 text-slate-950"><span className="block break-all font-medium">{session.device_id}</span>{session.app_version ? <span className="block text-xs text-slate-500">{session.app_version}</span> : null}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{shortId(session.user_id)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{session.platform}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{shortHash(session.machine_code_hash)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(session.last_seen_at, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(session.expires_at, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatOptionalDateTime(session.revoked_at, locale, t("licenses.notRevoked"))}</td>
                      <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                        {session.revoked_at ? null : (
                          <form action={revokeDesktopSession}>
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value="/admin/licenses" />
                            <input name="desktop_session_id" type="hidden" value={session.id} />
                            <ConfirmActionButton className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" confirmLabel={t("licenses.revoke")} pendingLabel={t("common.processing")}>{t("licenses.revoke")}</ConfirmActionButton>
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
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("licenses.device")}</th>
                    <th className="px-5 py-3">{t("licenses.user")}</th>
                    <th className="px-5 py-3">{t("licenses.session")}</th>
                    <th className="px-5 py-3">{t("licenses.lastHeartbeat")}</th>
                    <th className="px-5 py-3">{t("licenses.expiresAt")}</th>
                    <th className="px-5 py-3">{t("licenses.revokedAt")}</th>
                    <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leases.map((lease) => (
                    <tr key={lease.id}>
                      <td className="px-5 py-4 font-medium text-slate-950"><span className="block break-all">{lease.device_id}</span></td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{shortId(lease.user_id)}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-700">{shortId(lease.desktop_session_id)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(lease.last_heartbeat_at, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(lease.expires_at, locale)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatOptionalDateTime(lease.revoked_at, locale, t("licenses.notRevoked"))}</td>
                      <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                        {lease.revoked_at ? null : (
                          <form action={revokeCloudSyncLease}>
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value="/admin/licenses" />
                            <input name="cloud_sync_lease_id" type="hidden" value={lease.id} />
                            <ConfirmActionButton className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" confirmLabel={t("licenses.revoke")} pendingLabel={t("common.processing")}>{t("licenses.revoke")}</ConfirmActionButton>
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
