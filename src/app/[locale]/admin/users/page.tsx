import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminUserBulkToolbar, AdminUserSelectAllCheckbox } from "@/components/admin/admin-user-bulk-toolbar";
import { AdminUserFilters } from "@/components/admin/admin-user-filters";
import { AdminFeedbackBanner, AdminCard, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { isOwnerProfile, requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bulkProcessUsers, softDeleteUser, unbindTrialMachine, updateUserAccountStatus, updateUserAdminRole } from "../actions";

type AdminUsersSearchParams = {
  createdFrom?: string;
  createdTo?: string;
  error?: string;
  notice?: string;
  query?: string;
  role?: string;
  status?: string;
  type?: string;
};

type AdminUsersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminUsersSearchParams>;
};

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchesSearch(profile: { display_name: string | null; email: string | null; id: string }, query?: string) {
  const normalized = String(query ?? "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [profile.email ?? "", profile.display_name ?? "", profile.id].some((value) => value.toLowerCase().includes(normalized));
}

function matchesRole(profile: { admin_role: string | null; is_admin: boolean | null }, role?: string) {
  if (!role) {
    return true;
  }

  const resolvedRole = profile.admin_role ?? (profile.is_admin ? "owner" : "user");
  return resolvedRole === role;
}

function matchesStatus(profile: { account_status: string | null }, status?: string) {
  return !status || (profile.account_status ?? "active") === status;
}

function matchesType(profile: { is_admin: boolean | null }, type?: string) {
  if (!type) {
    return true;
  }

  return type === "admin" ? profile.is_admin === true : profile.is_admin !== true;
}

function matchesCreatedAt(profile: { created_at: string }, createdFrom?: string, createdTo?: string) {
  const value = new Date(profile.created_at).getTime();
  const start = createdFrom ? new Date(createdFrom).getTime() : null;
  const end = createdTo ? new Date(`${createdTo}T23:59:59.999Z`).getTime() : null;

  if (start && value < start) {
    return false;
  }

  if (end && value > end) {
    return false;
  }

  return true;
}

export default async function AdminUsersPage({ params, searchParams }: AdminUsersPageProps) {
  const { locale } = await params;
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

  const [profilesResult, trialsResult, sessionsResult, adminProfileResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,admin_role,account_status,is_admin,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("trial_code_redemptions")
      .select("id,user_id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at")
      .order("redeemed_at", { ascending: false })
      .limit(200),
    supabase
      .from("desktop_sessions")
      .select("id,user_id,device_id,machine_code_hash,platform,app_version,last_seen_at,revoked_at")
      .order("last_seen_at", { ascending: false })
      .limit(200),
    supabase
      .from("profiles")
      .select("is_admin,admin_role,account_status")
      .eq("id", admin.id)
      .single(),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (trialsResult.error) throw trialsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (adminProfileResult.error) throw adminProfileResult.error;

  const allProfiles = profilesResult.data ?? [];
  const canManageRoles = isOwnerProfile(adminProfileResult.data);

  const trialsByUser = new Map<string, NonNullable<typeof trialsResult.data>>();
  for (const trial of trialsResult.data ?? []) {
    const current = trialsByUser.get(trial.user_id) ?? [];
    current.push(trial);
    trialsByUser.set(trial.user_id, current);
  }

  const sessionsByUser = new Map<string, NonNullable<typeof sessionsResult.data>>();
  for (const session of sessionsResult.data ?? []) {
    const current = sessionsByUser.get(session.user_id) ?? [];
    current.push(session);
    sessionsByUser.set(session.user_id, current);
  }

  const filteredProfiles = allProfiles.filter((profile) => {
    return (
      matchesSearch(profile, feedback?.query) &&
      matchesRole(profile, feedback?.role) &&
      matchesStatus(profile, feedback?.status) &&
      matchesType(profile, feedback?.type) &&
      matchesCreatedAt(profile, feedback?.createdFrom, feedback?.createdTo)
    );
  });

  const summary = {
    active: allProfiles.filter((profile) => (profile.account_status ?? "active") === "active").length,
    disabled: allProfiles.filter((profile) => profile.account_status === "disabled").length,
    elevated: allProfiles.filter((profile) => profile.is_admin || profile.admin_role === "operator").length,
    total: allProfiles.length,
  };

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={adminT("shell.backToAdmin")}
          description={adminT("users.description")}
          eyebrow={t("eyebrow")}
          title={t("title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminCard className="p-4">
            <p className="text-sm text-slate-500">{t("summaryTotal")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.total}</p>
          </AdminCard>
          <AdminCard className="p-4">
            <p className="text-sm text-slate-500">{t("summaryActive")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.active}</p>
          </AdminCard>
          <AdminCard className="p-4">
            <p className="text-sm text-slate-500">{t("summaryDisabled")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.disabled}</p>
          </AdminCard>
          <AdminCard className="p-4">
            <p className="text-sm text-slate-500">{t("summaryElevated")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.elevated}</p>
          </AdminCard>
        </div>

        <AdminUserFilters
          actionPath={`/${locale}/admin/users`}
          labels={{
            allRoles: t("allRoles"),
            allStatuses: t("allStatuses"),
            allTypes: t("allTypes"),
            apply: t("applyFilters"),
            createdFrom: t("createdFrom"),
            createdTo: t("createdTo"),
            moreFilters: t("moreFilters"),
            reset: t("reset"),
            role: t("filterRole"),
            search: t("search"),
            searchPlaceholder: t("searchPlaceholder"),
            status: t("filterStatus"),
            type: t("filterType"),
          }}
          values={{
            createdFrom: feedback?.createdFrom,
            createdTo: feedback?.createdTo,
            query: feedback?.query,
            role: feedback?.role,
            status: feedback?.status,
            type: feedback?.type,
          }}
        />

        <AdminUserBulkToolbar
          canManageRoles={canManageRoles}
          formId="bulk-users-bulk-action-form"
          labels={{
            bulkDisable: t("bulkDisable"),
            bulkEnable: t("bulkEnable"),
            bulkRole: t("bulkChangeRole"),
            bulkSoftDelete: t("bulkSoftDelete"),
            clearSelection: t("clearSelection"),
            operatorRole: t("roles.operator"),
            ownerRole: t("roles.owner"),
            roleTarget: t("roleTarget"),
            selectedCount: t("selectedCount", { count: "0" }),
            userRole: t("roles.user"),
          }}
        />

        <form action={bulkProcessUsers} className="hidden" id="bulk-users-bulk-action-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="return_to" type="hidden" value="/admin/users" />
        </form>

        <AdminCard className="mt-6">
          {filteredProfiles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-base font-medium text-slate-950">{t("emptyFiltered")}</p>
              <Link className="mt-4 inline-flex min-h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href="/admin/users">
                {t("reset")}
              </Link>
            </div>
          ) : (
            <AdminTableShell label={t("title")}>
              <table aria-label={t("title")} className="min-w-[1540px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[320px]" />
                  <col className="w-[230px]" />
                  <col className="w-[150px]" />
                  <col className="w-[260px]" />
                  <col className="w-[220px]" />
                  <col className="w-[220px]" />
                  <col className="w-[300px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        <AdminUserSelectAllCheckbox formId="bulk-users-bulk-action-form" label={t("selectAll")} />
                      </th>
                    <th className="px-5 py-3">{t("user")}</th>
                    <th className="px-5 py-3">{t("role")}</th>
                    <th className="px-5 py-3">{t("type")}</th>
                    <th className="px-5 py-3">{t("status")}</th>
                    <th className="px-5 py-3">{t("devicesAndTrials")}</th>
                    <th className="px-5 py-3">{t("createdAt")}</th>
                    <th className="sticky right-0 z-10 w-[300px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProfiles.map((profile) => {
                    const trials = trialsByUser.get(profile.id) ?? [];
                    const sessions = sessionsByUser.get(profile.id) ?? [];
                    const resolvedRole = profile.admin_role ?? (profile.is_admin ? "owner" : "user");
                    const accountStatus = profile.account_status ?? "active";

                      return (
                        <tr key={profile.id}>
                          <td className="px-5 py-4 align-top">
                            <input aria-label={`Select ${profile.email}`} className="size-4 rounded border-slate-300" form="bulk-users-bulk-action-form" name="user_ids" type="checkbox" value={profile.id} />
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="break-all font-medium text-slate-950">{profile.email}</p>
                            <p className="mt-1 text-slate-600">{profile.display_name ?? "-"}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-500">{profile.id}</p>
                            <p className="mt-2 text-xs text-slate-500">{t("detailEntryHint")}</p>
                          </td>
                        <td className="px-5 py-4 align-top">
                          {canManageRoles ? (
                            <form action={updateUserAdminRole} className="flex gap-2">
                                <input name="locale" type="hidden" value={locale} />
                                <input name="return_to" type="hidden" value="/admin/users" />
                                <input name="user_id" type="hidden" value={profile.id} />
                                <select aria-label={t("role")} className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="admin_role" defaultValue={resolvedRole}>
                                  <option value="user">{t("roles.user")}</option>
                                  <option value="operator">{t("roles.operator")}</option>
                                  <option value="owner">{t("roles.owner")}</option>
                                </select>
                                <AdminSubmitButton aria-label={t("saveRole")} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium" pendingLabel={adminT("common.saving")}>
                                  {t("save")}
                                </AdminSubmitButton>
                            </form>
                          ) : (
                            <AdminStatusBadge tone={resolvedRole === "owner" ? "success" : resolvedRole === "operator" ? "warning" : "neutral"}>
                              {resolvedRole === "owner" ? t("ownerPill") : resolvedRole === "operator" ? t("operatorPill") : t("userPill")}
                            </AdminStatusBadge>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <AdminStatusBadge tone={profile.is_admin ? "success" : "neutral"}>
                            {profile.is_admin ? t("adminType") : t("standardType")}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2">
                            <AdminStatusBadge tone={accountStatus === "deleted" ? "warning" : accountStatus === "active" ? "success" : "danger"}>
                              {accountStatus === "deleted" ? t("deletedPill") : t(`statuses.${accountStatus}`)}
                            </AdminStatusBadge>
                            <form action={updateUserAccountStatus} className="flex gap-2">
                                <input name="locale" type="hidden" value={locale} />
                                <input name="return_to" type="hidden" value="/admin/users" />
                                <input name="user_id" type="hidden" value={profile.id} />
                                <select className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="account_status" defaultValue={accountStatus}>
                                  <option value="active">{t("statuses.active")}</option>
                                  <option value="disabled">{t("statuses.disabled")}</option>
                                  <option value="deleted">{t("deletedPill")}</option>
                                </select>
                                <AdminSubmitButton className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium" pendingLabel={adminT("common.saving")}>
                                  {t("save")}
                                </AdminSubmitButton>
                            </form>
                          </div>
                        </td>
                        <td className="min-w-56 px-5 py-4 align-top">
                          <p className="text-sm text-slate-700">{sessions.length} {t("devices")}</p>
                          <p className="mt-1 text-sm text-slate-700">{trials.length} {t("trials")}</p>
                          {trials[0]?.machine_code_hash ? <p className="mt-1 font-mono text-xs text-slate-500">{shortHash(trials[0].machine_code_hash)}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-700">{formatDate(profile.created_at, locale)}</td>
                          <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                            <div className="flex min-w-[260px] flex-wrap justify-end gap-2">
                              <Link className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white" href={`/admin/users/${profile.id}`}>
                                {t("manageUser")}
                              </Link>
                              {trials[0]?.machine_code_hash ? (
                                <form action={unbindTrialMachine}>
                                  <input name="locale" type="hidden" value={locale} />
                                  <input name="return_to" type="hidden" value="/admin/users" />
                                  <input name="trial_redemption_id" type="hidden" value={trials[0].id} />
                                  <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={t("unbind")} pendingLabel={adminT("common.processing")}>
                                    {t("unbind")}
                                  </ConfirmActionButton>
                              </form>
                            ) : null}
                            <form action={softDeleteUser}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/users" />
                              <input name="user_id" type="hidden" value={profile.id} />
                              <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={t("softDelete")} pendingLabel={adminT("common.processing")}>
                                {t("softDelete")}
                              </ConfirmActionButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableShell>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
