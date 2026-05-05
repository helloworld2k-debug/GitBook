import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminUserDeleteDangerZone } from "@/components/admin/admin-user-delete-danger-zone";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getAdminShellProps } from "@/lib/admin/shell";
import { isOwnerProfile, requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addManualDonation,
  permanentlyDeleteUser,
  revokeCloudSyncLease,
  revokeDesktopSession,
  unbindTrialMachine,
  updateAdminUserProfile,
  updateUserAccountStatus,
  updateUserAdminRole,
} from "../../actions";

type AdminUserDetailPageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amount / 100);
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-950">{value}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params, searchParams }: AdminUserDetailPageProps) {
  const { id, locale } = await params;
  const feedback = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const admin = await requireAdmin(locale);
  const t = await getTranslations("admin.users");
  const adminT = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/users");
  const supabase = createSupabaseAdminClient();

  const [
    profileResult,
    donationsResult,
    certificatesResult,
    trialsResult,
    sessionsResult,
    entitlementsResult,
    leasesResult,
    adminProfileResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,is_admin,created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("donations")
      .select("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("certificates")
      .select("id,certificate_number,type,status,issued_at")
      .eq("user_id", id)
      .order("issued_at", { ascending: false })
      .limit(50),
    supabase
      .from("trial_code_redemptions")
      .select("id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at")
      .eq("user_id", id)
      .order("redeemed_at", { ascending: false })
      .limit(50),
    supabase
      .from("desktop_sessions")
      .select("id,device_id,machine_code_hash,platform,app_version,last_seen_at,revoked_at")
      .eq("user_id", id)
      .order("last_seen_at", { ascending: false })
      .limit(50),
    supabase
      .from("license_entitlements")
      .select("id,feature_code,valid_until,status,source_donation_id,updated_at")
      .eq("user_id", id)
      .order("valid_until", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_leases")
      .select("id,desktop_session_id,device_id,last_heartbeat_at,expires_at,revoked_at,updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("is_admin,admin_role,account_status")
      .eq("id", admin.id)
      .single(),
  ]);

  if (profileResult.error || !profileResult.data) {
    notFound();
  }

  if (donationsResult.error) throw donationsResult.error;
  if (certificatesResult.error) throw certificatesResult.error;
  if (trialsResult.error) throw trialsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (entitlementsResult.error) throw entitlementsResult.error;
  if (leasesResult.error) throw leasesResult.error;
  if (adminProfileResult.error) throw adminProfileResult.error;

  const profile = profileResult.data;
  const donations = donationsResult.data ?? [];
  const certificates = certificatesResult.data ?? [];
  const trials = trialsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];
  const leases = leasesResult.data ?? [];
  const canManageRoles = isOwnerProfile(adminProfileResult.data);

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin/users"
          backLabel={adminT("shell.users")}
          description={t("detailDescription")}
          eyebrow={t("eyebrow")}
          title={t("detailTitle")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <AdminCard className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-950">{t("details")}</h2>
                <p className="mt-1 break-all text-sm text-slate-600">{profile.email}</p>
              </div>
              <AdminStatusBadge tone={profile.account_status === "active" ? "success" : "danger"}>
                {t(`statuses.${profile.account_status ?? "active"}`)}
              </AdminStatusBadge>
            </div>

            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailRow label="Email" value={profile.email} />
              <DetailRow label="User ID" value={<span className="font-mono text-xs">{profile.id}</span>} />
              <DetailRow label={t("role")} value={t(`roles.${profile.admin_role ?? (profile.is_admin ? "owner" : "user")}`)} />
              <DetailRow label="Created" value={formatDateTime(profile.created_at, locale)} />
            </dl>

            <form action={updateAdminUserProfile} className="mt-5 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
              <input name="user_id" type="hidden" value={profile.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("displayName")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    defaultValue={profile.display_name ?? ""}
                    maxLength={80}
                    name="display_name"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("publicDisplayName")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
                    defaultValue={profile.public_display_name ?? ""}
                    maxLength={80}
                    name="public_display_name"
                  />
                </label>
              </div>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  className="size-4 rounded border-slate-300"
                  defaultChecked={profile.public_supporter_enabled}
                  name="public_supporter_enabled"
                  type="checkbox"
                />
                {t("publicSupporter")}
              </label>
              <AdminSubmitButton className="inline-flex min-h-10 w-fit items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={adminT("common.saving")}>
                {t("save")}
              </AdminSubmitButton>
            </form>
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("addDonation")}</h2>
            <form action={addManualDonation} className="mt-4 grid gap-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
              <input name="user_identifier" type="hidden" value={profile.id} />
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {adminT("donations.amountCents")}
                <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" min="1" name="amount" required type="number" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {adminT("donations.reference")}
                <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" maxLength={120} name="reference" required />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {adminT("donations.reason")}
                <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" maxLength={500} name="reason" required />
              </label>
              <AdminSubmitButton className="inline-flex min-h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={adminT("common.processing")}>
                {t("addDonation")}
              </AdminSubmitButton>
            </form>
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("role")}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {canManageRoles ? (
                <form action={updateUserAdminRole} className="flex flex-wrap gap-2">
                  <input name="locale" type="hidden" value={locale} />
                  <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                  <input name="user_id" type="hidden" value={profile.id} />
                  <select aria-label={t("role")} className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="admin_role" defaultValue={profile.admin_role ?? (profile.is_admin ? "owner" : "user")}>
                    <option value="user">{t("roles.user")}</option>
                    <option value="operator">{t("roles.operator")}</option>
                    <option value="owner">{t("roles.owner")}</option>
                  </select>
                  <AdminSubmitButton aria-label={t("saveRole")} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium" pendingLabel={adminT("common.saving")}>
                    {t("save")}
                  </AdminSubmitButton>
                </form>
              ) : (
                <p className="text-sm text-slate-700">{t(`roles.${profile.admin_role ?? (profile.is_admin ? "owner" : "user")}`)}</p>
              )}
              <form action={updateUserAccountStatus} className="flex flex-wrap gap-2">
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                <input name="user_id" type="hidden" value={profile.id} />
                <select className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="account_status" defaultValue={profile.account_status ?? "active"}>
                  <option value="active">{t("statuses.active")}</option>
                  <option value="disabled">{t("statuses.disabled")}</option>
                  <option value="deleted">{t("statuses.deleted")}</option>
                </select>
                <AdminSubmitButton className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium" pendingLabel={adminT("common.saving")}>
                  {t("save")}
                </AdminSubmitButton>
              </form>
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("trials")}</h2>
            {trials.length > 0 ? (
              <div className="mt-4 space-y-3">
                {trials.map((trial) => (
                  <div key={trial.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <AdminStatusBadge tone={trial.bound_at ? "success" : "warning"}>
                        {trial.bound_at ? t("bound") : t("unbound")}
                      </AdminStatusBadge>
                      {trial.machine_code_hash ? (
                        <form action={unbindTrialMachine}>
                          <input name="locale" type="hidden" value={locale} />
                          <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                          <input name="trial_redemption_id" type="hidden" value={trial.id} />
                          <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={t("unbind")} pendingLabel={adminT("common.processing")}>
                            {t("unbind")}
                          </ConfirmActionButton>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {t("redeemed")}: {formatDateTime(trial.redeemed_at, locale)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {t("validUntil")}: {formatDateTime(trial.trial_valid_until, locale)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {t("machine")}: {shortHash(trial.machine_code_hash)}
                    </p>
                    {trial.device_id ? <p className="mt-1 text-xs text-slate-600">{trial.device_id}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t("emptyTrials")}</p>
            )}
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminCard>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("donations")}</h2>
            </div>
            {donations.length > 0 ? (
              <AdminTableShell label={t("donations")}>
                <table aria-label={t("donations")} className="min-w-[860px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[160px]" />
                    <col className="w-[180px]" />
                    <col className="w-[240px]" />
                    <col className="w-[280px]" />
                  </colgroup>
                  <tbody className="divide-y divide-slate-200">
                    {donations.map((donation) => (
                      <tr key={donation.id}>
                        <td className="px-5 py-4 text-slate-950">{formatAmount(donation.amount, donation.currency, locale)}</td>
                        <td className="px-5 py-4 text-slate-700">{donation.provider} / {donation.status}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(donation.paid_at ?? donation.created_at, locale)}</td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-700">
                          <span className="block break-all">{donation.provider_transaction_id}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("emptyDonations")}</p>
            )}
          </AdminCard>

          <AdminCard>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">{t("certificates")}</h2>
            </div>
            {certificates.length > 0 ? (
              <AdminTableShell label={t("certificates")}>
                <table aria-label={t("certificates")} className="min-w-[760px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[260px]" />
                    <col className="w-[140px]" />
                    <col className="w-[140px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <tbody className="divide-y divide-slate-200">
                    {certificates.map((certificate) => (
                      <tr key={certificate.id}>
                        <td className="px-5 py-4 font-mono text-xs text-slate-950">
                          <span className="block break-all">{certificate.certificate_number}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{certificate.type}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{certificate.status}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDateTime(certificate.issued_at, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">{t("emptyCertificates")}</p>
            )}
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("sessions")}</h2>
            {sessions.length > 0 ? (
              <div className="mt-4 space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-950">{session.device_id}</p>
                    <p className="mt-1 text-xs text-slate-600">{session.platform} {session.app_version ?? ""}</p>
                    <p className="mt-1 text-xs text-slate-600">{t("lastSeen")}: {formatDateTime(session.last_seen_at, locale)}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600">{t("machine")}: {shortHash(session.machine_code_hash)}</p>
                    {session.revoked_at ? (
                      <p className="mt-2 text-xs font-medium text-slate-500">{formatDateTime(session.revoked_at, locale)}</p>
                    ) : (
                      <form action={revokeDesktopSession} className="mt-2">
                        <input name="locale" type="hidden" value={locale} />
                        <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                        <input name="desktop_session_id" type="hidden" value={session.id} />
                        <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={adminT("licenses.revoke")} pendingLabel={adminT("common.processing")}>
                          {adminT("licenses.revoke")}
                        </ConfirmActionButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t("emptyDevices")}</p>
            )}
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("entitlements")}</h2>
            {entitlements.length > 0 ? (
              <div className="mt-4 space-y-3">
                {entitlements.map((entitlement) => (
                  <div key={entitlement.id} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-950">{entitlement.feature_code}</p>
                    <p className="mt-1 text-xs text-slate-600">{entitlement.status}</p>
                    <p className="mt-1 text-xs text-slate-600">{t("validUntil")}: {formatDateTime(entitlement.valid_until, locale)}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600">{shortId(entitlement.source_donation_id)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t("emptyEntitlements")}</p>
            )}
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("leases")}</h2>
            {leases.length > 0 ? (
              <div className="mt-4 space-y-3">
                {leases.map((lease) => (
                  <div key={lease.id} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-950">{lease.device_id}</p>
                    <p className="mt-1 text-xs text-slate-600">{adminT("licenses.lastHeartbeat")}: {formatDateTime(lease.last_heartbeat_at, locale)}</p>
                    <p className="mt-1 text-xs text-slate-600">{adminT("licenses.expiresAt")}: {formatDateTime(lease.expires_at, locale)}</p>
                    <p className="mt-1 font-mono text-xs text-slate-600">{shortId(lease.desktop_session_id)}</p>
                    {lease.revoked_at ? (
                      <p className="mt-2 text-xs font-medium text-slate-500">{formatDateTime(lease.revoked_at, locale)}</p>
                    ) : (
                      <form action={revokeCloudSyncLease} className="mt-2">
                        <input name="locale" type="hidden" value={locale} />
                        <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                        <input name="cloud_sync_lease_id" type="hidden" value={lease.id} />
                        <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={adminT("licenses.revoke")} pendingLabel={adminT("common.processing")}>
                          {adminT("licenses.revoke")}
                        </ConfirmActionButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">{t("emptyLeases")}</p>
            )}
          </AdminCard>
        </div>

        <AdminUserDeleteDangerZone
          action={permanentlyDeleteUser}
          email={profile.email}
          labels={{
            confirmation: t("deleteConfirmation"),
            description: t("dangerDescription"),
            hint: profile.email,
            submit: t("permanentDelete"),
            title: t("dangerZone"),
            warning: t("dangerWarning"),
          }}
          locale={locale}
          userId={profile.id}
        />
      </section>
    </AdminShell>
  );
}
