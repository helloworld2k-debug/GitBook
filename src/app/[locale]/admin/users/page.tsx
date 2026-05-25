import { Archive } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminAccountCreateForm } from "@/components/admin/admin-account-create-form";
import { AdminUserBulkToolbar, AdminUserSelectAllCheckbox } from "@/components/admin/admin-user-bulk-toolbar";
import { AdminUserFilters } from "@/components/admin/admin-user-filters";
import { AdminFeedbackBanner, AdminCard, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { isOwnerProfile, type AccountStatus, type AdminRole } from "@/lib/auth/guards";
import { setupAdminPage } from "@/lib/auth/page-guards";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bulkProcessUsers, createUserWithTemporaryPassword, inviteUserAccount, softDeleteUser, unbindTrialMachine, updateUserAccountStatus } from "../actions";

type AdminUsersSearchParams = {
  createdFrom?: string;
  createdTo?: string;
  error?: string;
  notice?: string;
  page?: string;
  query?: string;
  role?: string;
  sort?: string;
  order?: string;
  status?: string;
  type?: string;
};

type AdminUsersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminUsersSearchParams>;
};

type AdminAuthStatus = Database["public"]["Functions"]["get_admin_auth_user_status"]["Returns"][number];
type AdminPaginatedUser = {
  id: string;
  email: string;
  display_name: string | null;
  admin_role: string | null;
  account_status: string | null;
  is_admin: boolean | null;
  avatar_url: string | null;
  created_at: string;
};
type AdminPaginatedUsersResult = Omit<
  Database["public"]["Functions"]["get_admin_users_paginated"]["Returns"][number],
  "users"
> & {
  users: AdminPaginatedUser[];
};
type AdminUsersPaginatedArgs = Database["public"]["Functions"]["get_admin_users_paginated"]["Args"];

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

function getAuthProviderLabel(provider: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (provider === "google") return t("authGoogleProvider");
  if (provider === "github") return t("authGithubProvider");
  if (provider === "email") return t("authEmailProvider");

  return provider;
}

function getOAuthProviders(status: AdminAuthStatus) {
  return (status.identity_providers ?? []).filter((provider) => provider !== "email");
}

async function getAuthStatusesByUser(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
) {
  if (userIds.length === 0 || typeof supabase.rpc !== "function") {
    return new Map<string, AdminAuthStatus>();
  }

  const { data, error } = await supabase.rpc("get_admin_auth_user_status", { input_user_ids: userIds });

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((status) => [status.user_id, status]));
}

function AdminAuthStatusBadges({
  locale,
  status,
  t,
}: {
  locale: string;
  status: AdminAuthStatus | undefined;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (!status) {
    return null;
  }

  const oauthProviders = getOAuthProviders(status);

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <AdminStatusBadge tone={status.email_confirmed_at || status.confirmed_at ? "success" : "warning"}>
        {status.email_confirmed_at || status.confirmed_at ? t("authConfirmed") : t("authUnconfirmed")}
      </AdminStatusBadge>
      {status.invited_at ? <AdminStatusBadge tone="warning">{t("authInvited")}</AdminStatusBadge> : null}
      {oauthProviders.length > 0 ? <AdminStatusBadge tone="neutral">{t("authOAuthOnly")}</AdminStatusBadge> : null}
      {oauthProviders.map((provider) => (
        <AdminStatusBadge key={provider} tone="neutral">
          {getAuthProviderLabel(provider, t)}
        </AdminStatusBadge>
      ))}
      {status.has_password ? (
        <AdminStatusBadge tone="success">{t("authHasPassword")}</AdminStatusBadge>
      ) : oauthProviders.length > 0 ? (
        <AdminStatusBadge tone="neutral">{t("authEmailPasswordNotSet")}</AdminStatusBadge>
      ) : (
        <AdminStatusBadge tone="danger">{t("authNoPassword")}</AdminStatusBadge>
      )}
      {status.recovery_sent_at ? <AdminStatusBadge tone="warning">{t("authRecoverySent")}</AdminStatusBadge> : null}
      {status.last_sign_in_at ? (
        <span className="inline-flex min-h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600">
          {t("authLastSignIn")}: {formatDate(status.last_sign_in_at, locale)}
        </span>
      ) : null}
    </div>
  );
}

function nextAccountStatusActions(accountStatus: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  return [
    { label: t("changeStatusToActive"), value: "active" },
    { label: t("changeStatusToDisabled"), value: "disabled" },
    { label: t("changeStatusToDeleted"), value: "deleted" },
  ].filter((action) => action.value !== accountStatus);
}

export default async function AdminUsersPage({ params, searchParams }: AdminUsersPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale, user: admin } = await setupAdminPage(localeParam, `/${localeParam}/admin/users`);
  const t = await getTranslations("admin.users");
  const adminT = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/users");
  const supabase = createSupabaseAdminClient();

  // Pagination params
  const PAGE_SIZE = 20;
  const currentPage = Number(feedback?.page ?? 1);
  const sortColumn = feedback?.sort ?? "created_at";
  const sortDirection = feedback?.order ?? "desc";
  const paginatedUserArgs: AdminUsersPaginatedArgs = {
    input_page: currentPage,
    input_per_page: PAGE_SIZE,
    input_sort_column: sortColumn,
    input_sort_direction: sortDirection,
  };

  if (feedback?.query) paginatedUserArgs.input_search = feedback.query;
  if (feedback?.role) paginatedUserArgs.input_role_filter = feedback.role;
  if (feedback?.status) paginatedUserArgs.input_status_filter = feedback.status;
  if (feedback?.type) paginatedUserArgs.input_type_filter = feedback.type;
  if (feedback?.createdFrom) paginatedUserArgs.input_created_from = new Date(feedback.createdFrom).toISOString();
  if (feedback?.createdTo) {
    paginatedUserArgs.input_created_to = new Date(feedback.createdTo + "T23:59:59.999Z").toISOString();
  }

  // Call RPC for paginated users
  const { data: paginatedData, error: paginatedError } = await supabase.rpc(
    "get_admin_users_paginated",
    paginatedUserArgs,
  );

  if (paginatedError) throw paginatedError;

  const paginatedResult = paginatedData?.[0] as AdminPaginatedUsersResult | undefined;
  if (!paginatedResult) {
    throw new Error("Failed to get paginated users");
  }

  const users = paginatedResult.users;
  const totalCount = Number(paginatedResult.total_count ?? 0);
  const filteredCount = Number(paginatedResult.filtered_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // Get admin profile for permission check
  const { data: adminProfileResult, error: adminProfileError } = await supabase
    .from("profiles")
    .select("is_admin,admin_role,account_status")
    .eq("id", admin.id)
    .single();

  if (adminProfileError) throw adminProfileError;

  const canManageRoles = isOwnerProfile({
    ...adminProfileResult,
    admin_role: adminProfileResult?.admin_role as AdminRole | null,
    account_status: adminProfileResult?.account_status as AccountStatus | null,
  });

  // Get auth statuses for current page
  const authStatusByUser = await getAuthStatusesByUser(supabase, users.map((u) => u.id));

  // Get trials and sessions for current page only
  const userIds = users.map((u) => u.id);
  const [trialsResult, sessionsResult] = await Promise.all([
    supabase
      .from("trial_code_redemptions")
      .select("id,user_id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at")
      .in("user_id", userIds),
    supabase
      .from("desktop_sessions")
      .select("id,user_id,device_id,machine_code_hash,platform,app_version,last_seen_at,revoked_at")
      .in("user_id", userIds),
  ]);

  if (trialsResult.error) throw trialsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

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

  // Summary counts from RPC
  const summary = {
    active: 0, // Will be updated when we add summary to RPC
    disabled: 0,
    elevated: 0,
    total: totalCount,
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
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} getMessage={(key) => adminT(key)} />

        <div className="mb-6 flex justify-end">
          <Link
            className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href="/admin/archived-users"
            title={t("archiveEntryDescription")}
          >
            <Archive aria-hidden="true" className="size-4 shrink-0" />
            <span>{t("archiveEntry")}</span>
          </Link>
        </div>

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

        <AdminCard className="mt-6">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{t("accountCreationTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("accountCreationDescription")}</p>
          </div>
          <AdminAccountCreateForm
            canManageRoles={canManageRoles}
            createTempAction={createUserWithTemporaryPassword}
            inviteAction={inviteUserAccount}
            labels={{
              createInvite: t("createInvite"),
              createTempAccount: t("createTempAccount"),
              creationMode: t("creationMode"),
              displayName: t("displayName"),
              email: t("email"),
              generatePassword: t("generatePassword"),
              inviteMode: t("inviteMode"),
              operatorRole: t("roles.operator"),
              ownerRole: t("roles.owner"),
              role: t("roleTarget"),
              temporaryPassword: t("temporaryPassword"),
              tempPasswordMode: t("tempPasswordMode"),
              userRole: t("roles.user"),
            }}
            locale={locale}
          />
        </AdminCard>

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
            sortBy: t("sortBy"),
            sortOrder: t("sortOrder"),
          }}
          values={{
            createdFrom: feedback?.createdFrom,
            createdTo: feedback?.createdTo,
            query: feedback?.query,
            role: feedback?.role,
            status: feedback?.status,
            type: feedback?.type,
            sort: feedback?.sort,
            order: feedback?.order,
          }}
        />

        <div className="flex items-center justify-between">
          <AdminUserBulkToolbar
          canManageRoles={canManageRoles}
          formId="bulk-users-bulk-action-form"
          labels={{
            bulkDisable: t("bulkDisable"),
            bulkEnable: t("bulkEnable"),
            bulkRole: t("bulkChangeRole"),
            bulkSoftDelete: t("bulkSoftDelete"),
            bulkSoftDeleteSelected: t("bulkSoftDeleteSelected"),
            bulkArchiveDelete: t("bulkArchiveDelete"),
            bulkArchiveDeleteSelected: t("bulkArchiveDeleteSelected"),
            clearSelection: t("clearSelection"),
            dangerZone: t("dangerZone"),
            operatorRole: t("roles.operator"),
            ownerRole: t("roles.owner"),
            roleTarget: t("roleTarget"),
            selectedCount: t("selectedCount", { count: "__COUNT__" }),
            userRole: t("roles.user"),
            bulkEnableConfirm: t("bulkEnableConfirm"),
            bulkDisableConfirm: t("bulkDisableConfirm"),
            bulkRoleConfirm: t("bulkRoleConfirm"),
          }}
        />

        <form action={bulkProcessUsers} className="hidden" id="bulk-users-bulk-action-form">
          <input name="locale" type="hidden" value={locale} />
          <input name="return_to" type="hidden" value="/admin/users" />
        </form>

        <div className="ml-4">
          <a
            href={`/api/admin/users/export?locale=${locale}&query=${feedback?.query ?? ""}&role=${feedback?.role ?? ""}&status=${feedback?.status ?? ""}&type=${feedback?.type ?? ""}&sort=${feedback?.sort ?? "created_at"}&order=${feedback?.order ?? "desc"}`}
            className="inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t("export")}
          </a>
        </div>
      </div>

      <AdminCard className="mt-6">
          {users.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-base font-medium text-slate-950">{filteredCount < totalCount ? t("emptyFiltered") : t("empty")}</p>
              {filteredCount < totalCount ? (
                <Link className="mt-4 inline-flex min-h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href="/admin/users">
                  {t("reset")}
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <AdminTableShell
              label={t("title")}
              mobileCards={
                <div className="grid gap-3">
                  {users.map((profile) => {
                    const trials = trialsByUser.get(profile.id) ?? [];
                    const sessions = sessionsByUser.get(profile.id) ?? [];
                    const authStatus = authStatusByUser.get(profile.id);
                    const resolvedRole = profile.admin_role ?? (profile.is_admin ? "owner" : "user");
                    const accountStatus = profile.account_status ?? "active";

                    return (
                      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={profile.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                              <svg className="size-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <Link aria-label={t("viewDetails")} className="break-all text-sm font-semibold text-slate-950 underline-offset-4 hover:underline" href={`/admin/users/${profile.id}`}>
                                {profile.email}
                              </Link>
                              <p className="mt-1 text-sm text-slate-600">{profile.display_name ?? "-"}</p>
                              <p className="mt-1 break-all font-mono text-xs text-slate-500">{profile.id}</p>
                              <AdminAuthStatusBadges locale={locale} status={authStatus} t={t} />
                            </div>
                          </div>
                          <AdminStatusBadge tone={accountStatus === "deleted" ? "warning" : accountStatus === "active" ? "success" : "danger"}>
                            {accountStatus === "deleted" ? t("deletedPill") : t(`statuses.${accountStatus}`)}
                          </AdminStatusBadge>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("role")}</dt>
                            <dd className="font-medium text-slate-900">
                              {resolvedRole === "owner" ? t("ownerPill") : resolvedRole === "operator" ? t("operatorPill") : t("userPill")}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("type")}</dt>
                            <dd className="text-slate-900">{profile.is_admin ? t("adminType") : t("standardType")}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("devicesAndTrials")}</dt>
                            <dd className="text-right text-slate-900">
                              {sessions.length} {t("devices")} / {trials.length} {t("trials")}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("createdAt")}</dt>
                            <dd className="text-right text-slate-900">{formatDate(profile.created_at, locale)}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <details aria-label={t("moreActions")} className="relative flex-1">
                            <summary className="inline-flex min-h-10 w-full cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" role="button">
                              {t("moreActions")}
                            </summary>
                            <div className="mt-2 grid gap-3 rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg">
                              <Link className="text-sm font-semibold text-slate-950" href={`/admin/users/${profile.id}`}>
                                {t("viewDetails")}
                              </Link>
                              {nextAccountStatusActions(accountStatus, t).map((action) => (
                                <form action={updateUserAccountStatus} key={action.value}>
                                  <input name="locale" type="hidden" value={locale} />
                                  <input name="return_to" type="hidden" value="/admin/users" />
                                  <input name="user_id" type="hidden" value={profile.id} />
                                  <input name="account_status" type="hidden" value={action.value} />
                                  <AdminSubmitButton className="text-sm font-semibold text-slate-700" pendingLabel={adminT("common.saving")}>
                                    {action.label}
                                  </AdminSubmitButton>
                                </form>
                              ))}
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
                          </details>
                        </div>
                      </article>
                    );
                  })}
                </div>
              }
            >
              <table aria-label={t("title")} className="min-w-[1580px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[60px]" />
                  <col className="w-[260px]" />
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
                    <th className="px-4 py-3"></th>
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
                  {users.map((profile) => {
                    const trials = trialsByUser.get(profile.id) ?? [];
                    const sessions = sessionsByUser.get(profile.id) ?? [];
                    const authStatus = authStatusByUser.get(profile.id);
                    const resolvedRole = profile.admin_role ?? (profile.is_admin ? "owner" : "user");
                    const accountStatus = profile.account_status ?? "active";

                      return (
                        <tr key={profile.id}>
                          <td className="px-5 py-4 align-top">
                            <input aria-label={`Select ${profile.email}`} className="size-4 rounded border-slate-300" form="bulk-users-bulk-action-form" name="user_ids" type="checkbox" value={profile.id} />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex size-10 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                              <svg className="size-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <Link className="break-all font-medium text-slate-950 underline-offset-4 hover:underline" href={`/admin/users/${profile.id}`}>
                              {profile.email}
                            </Link>
                            <p className="mt-1 text-slate-600">{profile.display_name ?? "-"}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-500">{profile.id}</p>
                            <AdminAuthStatusBadges locale={locale} status={authStatus} t={t} />
                          </td>
                        <td className="px-5 py-4 align-top">
                          <AdminStatusBadge tone={resolvedRole === "owner" ? "success" : resolvedRole === "operator" ? "warning" : "neutral"}>
                            {resolvedRole === "owner" ? t("ownerPill") : resolvedRole === "operator" ? t("operatorPill") : t("userPill")}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <AdminStatusBadge tone={profile.is_admin ? "success" : "neutral"}>
                            {profile.is_admin ? t("adminType") : t("standardType")}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <AdminStatusBadge tone={accountStatus === "deleted" ? "warning" : accountStatus === "active" ? "success" : "danger"}>
                            {accountStatus === "deleted" ? t("deletedPill") : t(`statuses.${accountStatus}`)}
                          </AdminStatusBadge>
                        </td>
                        <td className="min-w-56 px-5 py-4 align-top">
                          <p className="text-sm text-slate-700">{sessions.length} {t("devices")}</p>
                          <p className="mt-1 text-sm text-slate-700">{trials.length} {t("trials")}</p>
                          {trials[0]?.machine_code_hash ? <p className="mt-1 font-mono text-xs text-slate-500">{shortHash(trials[0].machine_code_hash)}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-700">{formatDate(profile.created_at, locale)}</td>
                          <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                            <div className="flex min-w-[260px] flex-wrap justify-end gap-2">
                              <details aria-label={t("moreActions")} className="relative">
                                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950" role="button">
                                  {t("moreActions")}
                                </summary>
                                <div className="absolute right-0 z-20 mt-2 grid w-56 gap-3 rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg">
                                  <Link className="text-sm font-semibold text-slate-950" href={`/admin/users/${profile.id}`}>
                                    {t("viewDetails")}
                                  </Link>
                                  {nextAccountStatusActions(accountStatus, t).map((action) => (
                                    <form action={updateUserAccountStatus} key={action.value}>
                                      <input name="locale" type="hidden" value={locale} />
                                      <input name="return_to" type="hidden" value="/admin/users" />
                                      <input name="user_id" type="hidden" value={profile.id} />
                                      <input name="account_status" type="hidden" value={action.value} />
                                      <AdminSubmitButton className="text-sm font-semibold text-slate-700" pendingLabel={adminT("common.saving")}>
                                        {action.label}
                                      </AdminSubmitButton>
                                    </form>
                                  ))}
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
                              </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableShell>
            <AdminPagination
              basePath="/admin/users"
              currentPage={currentPage}
              totalPages={totalPages}
              labels={{
                previous: adminT("pagination.previous"),
                next: adminT("pagination.next"),
                page: adminT("pagination.page"),
                of: adminT("pagination.of"),
              }}
            />
            </>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
