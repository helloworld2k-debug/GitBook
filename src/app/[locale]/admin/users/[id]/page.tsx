import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminTemporaryPasswordField } from "@/components/admin/admin-temporary-password-field";
import { AdminUserDeleteDangerZone } from "@/components/admin/admin-user-delete-danger-zone";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { isOwnerProfile, type AccountStatus, type AdminRole } from "@/lib/auth/guards";
import { setupAdminPage } from "@/lib/auth/page-guards";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addManualDonation,
  grantCloudSyncCooldownOverride,
  permanentlyDeleteUser,
  revokeCertificate,
  revokeCloudSyncLease,
  revokeDesktopSession,
  sendUserPasswordSetupEmail,
  setUserTemporaryPassword,
  unbindTrialMachine,
  updateAdminUserProfile,
  updateUserAccountType,
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

type TimelineItem = {
  date: string | null;
  detail: string;
  href?: string;
  label: string;
  title: string;
};

type CloudSyncUsageSessionRow = {
  id: string;
  lease_id: string;
  desktop_session_id: string;
  device_id: string;
  machine_code_hash: string;
  started_at: string;
  last_heartbeat_at: string;
  ended_at: string | null;
  end_reason: string | null;
  heartbeat_count: number;
};

type CloudSyncUsageEventRow = {
  id: string;
  event_type: string;
  reason: string | null;
  device_id: string | null;
  machine_code_hash: string | null;
  occurred_at: string;
};

type AdminAuthStatus = Database["public"]["Functions"]["get_admin_auth_user_status"]["Returns"][number];

type LoginHistoryRow = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  login_method: string | null;
  logged_in_at: string;
};

type DonationRow = {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  provider_transaction_id: string;
  paid_at: string | null;
  created_at: string;
};

type CertificateRow = {
  id: string;
  certificate_number: string;
  donation_id: string | null;
  type: string;
  status: string;
  issued_at: string | null;
};

type SupportCertificateRow =
  | {
      kind: "donation";
      id: string;
      record: string;
      paymentStatus: string;
      amount: string;
      reference: string;
      certificate: CertificateRow | null;
      time: string | null;
    }
  | {
      kind: "honor";
      id: string;
      record: string;
      paymentStatus: string;
      amount: string;
      reference: string;
      certificate: CertificateRow;
      time: string | null;
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

function getAccountTypeLabel(accountType: string | null | undefined, t: Awaited<ReturnType<typeof getTranslations>>) {
  return accountType === "ai_test" ? t("aiTestType") : t("standardType");
}

function formatAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amount / 100);
}

function getAuthProviderLabel(provider: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (provider === "google") return t("authGoogleProvider");
  if (provider === "github") return t("authGithubProvider");
  if (provider === "email") return t("authEmailProvider");

  return provider;
}

function getOAuthProviders(authStatus: AdminAuthStatus) {
  return (authStatus.identity_providers ?? []).filter((provider) => provider !== "email");
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

function formatUsageDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function usageSeconds(session: CloudSyncUsageSessionRow, now = new Date()) {
  const startedAt = new Date(session.started_at).getTime();
  const endedAt = new Date(session.ended_at ?? session.last_heartbeat_at ?? now.toISOString()).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt <= startedAt) {
    return 0;
  }

  return Math.round((endedAt - startedAt) / 1000);
}

function isOwnerUserProfile(profile: { admin_role?: string | null; is_admin?: boolean | null }) {
  return profile.is_admin === true || profile.admin_role === "owner";
}

function isNoRowsError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST116";
}

function getCertificateStatusTone(status: string | null | undefined) {
  if (status === "active") return "success";
  if (status === "revoked") return "danger";
  if (status === "generation_failed") return "warning";
  return "neutral";
}

function getSupportCertificateRows({
  certificates,
  donations,
  locale,
  t,
}: {
  certificates: CertificateRow[];
  donations: DonationRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const donationCertificateByDonationId = new Map(
    certificates
      .filter((certificate) => certificate.type === "donation" && certificate.donation_id)
      .map((certificate) => [certificate.donation_id as string, certificate]),
  );
  const donationRows: SupportCertificateRow[] = donations.map((donation) => ({
    kind: "donation",
    id: `donation-${donation.id}`,
    record: `${donation.provider} / ${donation.provider_transaction_id}`,
    paymentStatus: donation.status,
    amount: formatAmount(donation.amount, donation.currency, locale),
    reference: donation.provider_transaction_id,
    certificate: donationCertificateByDonationId.get(donation.id) ?? null,
    time: donation.paid_at ?? donation.created_at,
  }));
  const honorRows: SupportCertificateRow[] = certificates
    .filter((certificate) => certificate.type === "honor")
    .map((certificate) => ({
      kind: "honor",
      id: `certificate-${certificate.id}`,
      record: t("supportCertificateHonorRecord"),
      paymentStatus: "-",
      amount: "-",
      reference: t("supportCertificateHonorSource"),
      certificate,
      time: certificate.issued_at,
    }));

  return [...donationRows, ...honorRows].sort((a, b) => new Date(b.time ?? "").getTime() - new Date(a.time ?? "").getTime());
}

function AdminMissingUserState({
  id,
  shellProps,
  t,
}: {
  id: string;
  shellProps: Awaited<ReturnType<typeof getAdminShellProps>>;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-3xl">
        <AdminPageHeader
          backHref="/admin/users"
          backLabel={t("title")}
          description={t("missingDescription", { id })}
          eyebrow={t("eyebrow")}
          title={t("missingTitle")}
        />
        <AdminCard className="p-5">
          <p className="text-sm leading-6 text-slate-700">{t("missingHelp")}</p>
        </AdminCard>
      </section>
    </AdminShell>
  );
}

function isOptionalCloudSyncDetailSchemaError(error: { code?: string; message?: string } | null) {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "42P01" ||
    code === "PGRST204" ||
    message.includes("cloud_sync_usage_sessions") ||
    message.includes("cloud_sync_usage_events") ||
    message.includes("cloud_sync_cooldown_overrides") ||
    message.includes("schema cache")
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-950">{value}</dd>
    </div>
  );
}

async function getAuthStatus(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  if (typeof supabase.rpc !== "function") {
    return null;
  }

  const { data, error } = await supabase.rpc("get_admin_auth_user_status", { input_user_ids: [userId] });

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

function AuthStatusBadges({
  authStatus,
  locale,
  t,
}: {
  authStatus: AdminAuthStatus | null;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (!authStatus) {
    return null;
  }

  const oauthProviders = getOAuthProviders(authStatus);

  return (
    <div className="mt-3 flex flex-wrap gap-1">
      <AdminStatusBadge tone={authStatus.email_confirmed_at || authStatus.confirmed_at ? "success" : "warning"}>
        {authStatus.email_confirmed_at || authStatus.confirmed_at ? t("authConfirmed") : t("authUnconfirmed")}
      </AdminStatusBadge>
      {authStatus.invited_at ? <AdminStatusBadge tone="warning">{t("authInvited")}</AdminStatusBadge> : null}
      {oauthProviders.length > 0 ? <AdminStatusBadge tone="neutral">{t("authOAuthOnly")}</AdminStatusBadge> : null}
      {oauthProviders.map((provider) => (
        <AdminStatusBadge key={provider} tone="neutral">
          {getAuthProviderLabel(provider, t)}
        </AdminStatusBadge>
      ))}
      {authStatus.has_password ? (
        <AdminStatusBadge tone="success">{t("authHasPassword")}</AdminStatusBadge>
      ) : oauthProviders.length > 0 ? (
        <AdminStatusBadge tone="neutral">{t("authEmailPasswordNotSet")}</AdminStatusBadge>
      ) : (
        <AdminStatusBadge tone="danger">{t("authNoPassword")}</AdminStatusBadge>
      )}
      {authStatus.recovery_sent_at ? <AdminStatusBadge tone="warning">{t("authRecoverySent")}</AdminStatusBadge> : null}
      {authStatus.last_sign_in_at ? (
        <span className="inline-flex min-h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600">
          {t("authLastSignIn")}: {formatDateTime(authStatus.last_sign_in_at, locale)}
        </span>
      ) : null}
    </div>
  );
}

export default async function AdminUserDetailPage({ params, searchParams }: AdminUserDetailPageProps) {
  const { id, locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale, user: admin } = await setupAdminPage(localeParam, `/${localeParam}/admin/users/${id}`);
  const t = await getTranslations("admin.users");
  const adminT = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/users");
  const supabase = createSupabaseAdminClient();

  const [
    profileResult,
    donationsResult,
    certificatesResult,
    trialsResult,
    sessionsResult,
    entitlementsResult,
    leasesResult,
    usageSessionsResult,
    usageEventsResult,
    cooldownOverridesResult,
    supportFeedbackResult,
    loginHistoryResult,
    adminProfileResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,account_type,is_admin,avatar_url,created_at")
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
      .select("id,certificate_number,donation_id,type,status,issued_at")
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
      .select("id,desktop_session_id,device_id,last_heartbeat_at,expires_at,revoked_at,released_at,cooldown_until,updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_usage_sessions")
      .select("id,lease_id,desktop_session_id,device_id,machine_code_hash,started_at,last_heartbeat_at,ended_at,end_reason,heartbeat_count")
      .eq("user_id", id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_usage_events")
      .select("id,event_type,reason,device_id,machine_code_hash,occurred_at")
      .eq("user_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_cooldown_overrides")
      .select("id,expires_at,consumed_at,reason,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("support_feedback")
      .select("id,subject,status,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_login_history")
      .select("id,ip_address,user_agent,success,failure_reason,login_method,logged_in_at")
      .eq("user_id", id)
      .order("logged_in_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("is_admin,admin_role,account_status")
      .eq("id", admin.id)
      .single(),
  ]);

  if (profileResult.error) {
    if (isNoRowsError(profileResult.error)) {
      return <AdminMissingUserState id={id} shellProps={shellProps} t={t} />;
    }

    throw profileResult.error;
  }

  if (!profileResult.data) {
    return <AdminMissingUserState id={id} shellProps={shellProps} t={t} />;
  }

  if (donationsResult.error) throw donationsResult.error;
  if (certificatesResult.error) throw certificatesResult.error;
  if (trialsResult.error) throw trialsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (entitlementsResult.error) throw entitlementsResult.error;
  if (leasesResult.error) throw leasesResult.error;
  if (usageSessionsResult.error && !isOptionalCloudSyncDetailSchemaError(usageSessionsResult.error)) throw usageSessionsResult.error;
  if (usageEventsResult.error && !isOptionalCloudSyncDetailSchemaError(usageEventsResult.error)) throw usageEventsResult.error;
  if (cooldownOverridesResult.error && !isOptionalCloudSyncDetailSchemaError(cooldownOverridesResult.error)) throw cooldownOverridesResult.error;
  if (supportFeedbackResult.error) throw supportFeedbackResult.error;
  if (loginHistoryResult.error && !isOptionalCloudSyncDetailSchemaError(loginHistoryResult.error)) throw loginHistoryResult.error;
  if (adminProfileResult.error) throw adminProfileResult.error;

  const profile = profileResult.data;
  const authStatus = await getAuthStatus(supabase, profile.id);
  const donations = (donationsResult.data ?? []) as DonationRow[];
  const certificates = (certificatesResult.data ?? []) as CertificateRow[];
  const trials = trialsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const entitlements = entitlementsResult.data ?? [];
  const leases = leasesResult.data ?? [];
  const usageSessions = (usageSessionsResult.data ?? []) as CloudSyncUsageSessionRow[];
  const usageEvents = (usageEventsResult.data ?? []) as CloudSyncUsageEventRow[];
  const cooldownOverrides = cooldownOverridesResult.data ?? [];
  const supportFeedback = supportFeedbackResult.data ?? [];
  const loginHistory = (loginHistoryResult.data ?? []) as LoginHistoryRow[];
  const canManageRoles = isOwnerProfile({
    ...adminProfileResult.data,
    admin_role: adminProfileResult.data?.admin_role as AdminRole | null,
    account_status: adminProfileResult.data?.account_status as AccountStatus | null,
  });
  const canPermanentlyDeleteUser = canManageRoles || !isOwnerUserProfile(profile);
  const activeLease = leases.find((lease) => !lease.revoked_at);
  const totalUsageSeconds = usageSessions.reduce((total, session) => total + usageSeconds(session), 0);
  const uniqueUsageMachines = new Set(usageSessions.map((session) => session.machine_code_hash).filter(Boolean)).size;
  const conflictAttempts = usageEvents.filter((event) => event.event_type === "activate_conflict").length;
  const cooldownBlocks = usageEvents.filter((event) => event.event_type === "cooldown_waiting").length;
  const recentForceSwitchCandidate = usageEvents.find((event) => event.event_type === "activate_conflict" && event.machine_code_hash);
  const latestUsageSession = usageSessions[0];
  const supportCertificateRows = getSupportCertificateRows({ certificates, donations, locale, t });
  const timelineItems: TimelineItem[] = [
    ...supportFeedback.map((item) => ({
      date: item.created_at,
      detail: item.status,
      href: `/${locale}/admin/support-feedback/${item.id}`,
      label: t("timelineFeedback"),
      title: item.subject,
    })),
    ...leases.map((item) => ({
      date: item.updated_at,
      detail: formatDateTime(item.expires_at, locale),
      label: t("timelineLease"),
      title: item.device_id,
    })),
    ...sessions.map((item) => ({
      date: item.last_seen_at,
      detail: item.platform,
      label: t("timelineSession"),
      title: item.device_id,
    })),
    ...entitlements.map((item) => ({
      date: item.updated_at,
      detail: formatDateTime(item.valid_until, locale),
      label: t("timelineEntitlement"),
      title: item.feature_code,
    })),
    ...trials.map((item) => ({
      date: item.redeemed_at,
      detail: formatDateTime(item.trial_valid_until, locale),
      label: t("timelineTrial"),
      title: item.device_id ?? shortHash(item.machine_code_hash),
    })),
    ...certificates.map((item) => ({
      date: item.issued_at,
      detail: item.status,
      label: t("timelineCertificate"),
      title: item.certificate_number,
    })),
    ...donations.map((item) => ({
      date: item.paid_at ?? item.created_at,
      detail: `${item.provider} / ${item.status}`,
      label: t("timelineDonation"),
      title: formatAmount(item.amount, item.currency, locale),
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date ?? "").getTime() - new Date(a.date ?? "").getTime());

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

        {profile.account_status === "archived_deleted" ? (
          <AdminCard className="border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {adminT("users.userIsArchived")}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {adminT("users.userIsArchivedDescription")}
            </p>
            <a href={`/${locale}/admin/archived-users`} className="mt-2 inline-block text-sm font-semibold text-amber-900 underline">
              {adminT("users.goToArchivedUsers")}
            </a>
          </AdminCard>
        ) : null}

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
              <DetailRow label={t("email")} value={profile.email} />
              <DetailRow label={t("userId")} value={<span className="font-mono text-xs">{profile.id}</span>} />
              <DetailRow label={t("role")} value={t(`roles.${profile.admin_role ?? (profile.is_admin ? "owner" : "user")}`)} />
              <DetailRow label={t("accountType")} value={getAccountTypeLabel(profile.account_type, t)} />
              <DetailRow label={t("createdAt")} value={formatDateTime(profile.created_at, locale)} />
            </dl>

            <form action={updateAdminUserProfile} className="mt-5 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
              <input name="user_id" type="hidden" value={profile.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("displayName")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    defaultValue={profile.display_name ?? ""}
                    maxLength={80}
                    name="display_name"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("publicDisplayName")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
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
            <h2 className="text-base font-semibold text-slate-950">{t("passwordRecoveryTitle")}</h2>
            <AuthStatusBadges authStatus={authStatus} locale={locale} t={t} />
            {authStatus?.has_password === false ? (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {getOAuthProviders(authStatus).length > 0 ? t("passwordRecoveryOAuthDescription") : t("passwordRecoveryDescription")}
                </p>
                <div className="mt-4 grid gap-4">
                  <form action={sendUserPasswordSetupEmail}>
                    <input name="locale" type="hidden" value={locale} />
                    <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                    <input name="user_id" type="hidden" value={profile.id} />
                    <AdminSubmitButton className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white" pendingLabel={adminT("common.processing")}>
                      {t("sendPasswordSetup")}
                    </AdminSubmitButton>
                  </form>
                  <form action={setUserTemporaryPassword} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <input name="locale" type="hidden" value={locale} />
                    <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                    <input name="user_id" type="hidden" value={profile.id} />
                    <AdminTemporaryPasswordField generateLabel={t("generatePassword")} label={t("temporaryPassword")} />
                    <AdminSubmitButton className="mt-3 inline-flex min-h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700" pendingLabel={adminT("common.processing")}>
                      {t("setTemporaryPassword")}
                    </AdminSubmitButton>
                  </form>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">{authStatus ? t("authHasPassword") : t("authStatus")}</p>
            )}
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("loginHistoryTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("loginHistoryDescription")}</p>
            {loginHistory.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t("loginHistoryEmpty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">{t("loginHistoryTime")}</th>
                      <th className="px-4 py-2">{t("loginHistoryStatus")}</th>
                      <th className="px-4 py-2">{t("loginHistoryIP")}</th>
                      <th className="px-4 py-2">{t("loginHistoryMethod")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loginHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-slate-700">{formatDateTime(entry.logged_in_at, locale)}</td>
                        <td className="px-4 py-3">
                          {entry.success ? (
                            <AdminStatusBadge tone="success">{t("loginHistorySuccess")}</AdminStatusBadge>
                          ) : (
                            <AdminStatusBadge tone="danger">{entry.failure_reason ?? t("loginHistoryFailed")}</AdminStatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{entry.ip_address ?? "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{entry.login_method ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              <form action={updateUserAccountType} className="flex flex-wrap gap-2">
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                <input name="user_id" type="hidden" value={profile.id} />
                <select aria-label={t("accountType")} className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="account_type" defaultValue={profile.account_type ?? "standard"}>
                  <option value="standard">{t("standardType")}</option>
                  <option value="ai_test">{t("aiTestType")}</option>
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

        <AdminCard className="mt-6">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("supportCertificates")}</h2>
          </div>
          {supportCertificateRows.length > 0 ? (
            <AdminTableShell label={t("supportCertificates")}>
              <table aria-label={t("supportCertificates")} className="min-w-[1320px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[210px]" />
                  <col className="w-[150px]" />
                  <col className="w-[140px]" />
                  <col className="w-[220px]" />
                  <col className="w-[250px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[190px]" />
                  <col className="w-[260px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("supportCertificateRecord")}</th>
                    <th className="px-5 py-3">{t("supportCertificatePaymentStatus")}</th>
                    <th className="px-5 py-3">{t("supportCertificateAmount")}</th>
                    <th className="px-5 py-3">{t("supportCertificateReference")}</th>
                    <th className="px-5 py-3">{t("supportCertificateNumber")}</th>
                    <th className="px-5 py-3">{t("supportCertificateType")}</th>
                    <th className="px-5 py-3">{t("supportCertificateStatus")}</th>
                    <th className="px-5 py-3">{t("supportCertificateTime")}</th>
                    <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("supportCertificateAction")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {supportCertificateRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-4 align-top text-slate-950">{row.record}</td>
                      <td className="px-5 py-4 align-top text-slate-700">{row.paymentStatus}</td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{row.amount}</td>
                      <td className="px-5 py-4 align-top font-mono text-xs text-slate-700">
                        <span className="block break-all">{row.reference}</span>
                      </td>
                      <td className="px-5 py-4 align-top font-mono text-xs text-slate-950">
                        {row.certificate ? <span className="block break-all">{row.certificate.certificate_number}</span> : <span className="text-slate-500">{t("supportCertificateMissing")}</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{row.certificate?.type ?? "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 align-top">
                        {row.certificate ? (
                          <AdminStatusBadge tone={getCertificateStatusTone(row.certificate.status)}>
                            {row.certificate.status}
                          </AdminStatusBadge>
                        ) : (
                          <AdminStatusBadge tone="warning">{t("supportCertificateMissing")}</AdminStatusBadge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 align-top text-slate-700">{formatDateTime(row.time, locale)}</td>
                      <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                        {row.certificate?.status === "active" ? (
                          <form action={revokeCertificate} className="flex min-w-56 gap-2">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                            <input name="certificate_id" type="hidden" value={row.certificate.id} />
                            <label className="sr-only" htmlFor={`user-revoke-reason-${row.certificate.id}`}>
                              {t("supportCertificateAction")}
                            </label>
                            <input
                              className="min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                              id={`user-revoke-reason-${row.certificate.id}`}
                              maxLength={500}
                              name="reason"
                              placeholder={t("supportCertificateAction")}
                              required
                            />
                            <ConfirmActionButton className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-950" confirmLabel={adminT("certificates.revoke")} pendingLabel={adminT("common.processing")}>
                              {adminT("certificates.revoke")}
                            </ConfirmActionButton>
                          </form>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("supportCertificateEmpty")}</p>
          )}
        </AdminCard>

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
            <form action={grantCloudSyncCooldownOverride} className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
              <input name="user_id" type="hidden" value={profile.id} />
              <input name="override_type" type="hidden" value="skip_cooldown" />
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  {t("overrideExpiresAt")}
                  <input
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    name="expires_at"
                    required
                    type="datetime-local"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  {t("overrideReason")}
                  <input
                    className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    name="reason"
                    required
                  />
                </label>
                <AdminSubmitButton
                  className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  pendingLabel={adminT("common.processing")}
                >
                  {t("grantOverride")}
                </AdminSubmitButton>
              </div>
            </form>
            {recentForceSwitchCandidate?.machine_code_hash ? (
              <form action={grantCloudSyncCooldownOverride} className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/users/${profile.id}`} />
                <input name="user_id" type="hidden" value={profile.id} />
                <input name="override_type" type="hidden" value="force_switch" />
                <input name="target_device_id" type="hidden" value={recentForceSwitchCandidate.device_id ?? ""} />
                <div className="grid gap-3">
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    {t("overrideExpiresAt")}
                    <input
                      className="min-h-10 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                      name="expires_at"
                      required
                      type="datetime-local"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    {t("machine")}
                    <input
                      className="min-h-10 rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                      name="target_machine_code_hash"
                      readOnly
                      required
                      value={recentForceSwitchCandidate.machine_code_hash}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    {t("overrideReason")}
                    <input
                      className="min-h-10 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                      name="reason"
                      required
                    />
                  </label>
                  <AdminSubmitButton
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-amber-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                    pendingLabel={adminT("common.processing")}
                  >
                    Grant force switch
                  </AdminSubmitButton>
                </div>
              </form>
            ) : null}
            {cooldownOverrides.length > 0 ? (
              <div className="mt-4 space-y-2">
                {cooldownOverrides.map((override) => (
                  <div key={override.id} className="rounded-md border border-slate-200 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-950">{override.consumed_at ? t("overrideConsumed") : t("overrideActive")}</p>
                    <p className="mt-1">{t("validUntil")}: {formatDateTime(override.expires_at, locale)}</p>
                    {override.consumed_at ? <p className="mt-1">{t("overrideConsumedAt")}: {formatDateTime(override.consumed_at, locale)}</p> : null}
                    <p className="mt-1 break-words">{override.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {leases.length > 0 ? (
              <div className="mt-4 space-y-3">
                {leases.map((lease) => (
                  <div key={lease.id} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-950">{lease.device_id}</p>
                    <p className="mt-1 text-xs text-slate-600">{adminT("licenses.lastHeartbeat")}: {formatDateTime(lease.last_heartbeat_at, locale)}</p>
                    <p className="mt-1 text-xs text-slate-600">{adminT("licenses.expiresAt")}: {formatDateTime(lease.expires_at, locale)}</p>
                    <p className="mt-1 text-xs text-slate-600">{t("releasedAt")}: {formatDateTime(lease.released_at, locale)}</p>
                    <p className="mt-1 text-xs text-slate-600">{t("cooldownUntil")}: {formatDateTime(lease.cooldown_until, locale)}</p>
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

        <AdminCard className="mt-6 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t("cloudSyncUsageTitle")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("cloudSyncUsageDescription")}</p>
            </div>
            <AdminStatusBadge tone={activeLease ? "success" : "neutral"}>
              {activeLease ? t("cloudSyncUsageActive") : t("cloudSyncUsageInactive")}
            </AdminStatusBadge>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <DetailRow label={t("cloudSyncUsageTotal")} value={formatUsageDuration(totalUsageSeconds)} />
            <DetailRow label={t("cloudSyncUsageMachines")} value={uniqueUsageMachines} />
            <DetailRow label={t("cloudSyncUsageConflicts")} value={`${conflictAttempts} ${t("cloudSyncUsageConflictAttempts")}`} />
            <DetailRow label={t("cloudSyncUsageCooldowns")} value={`${cooldownBlocks} ${t("cloudSyncUsageCooldownBlocks")}`} />
            <DetailRow label={t("cloudSyncUsageLatest")} value={latestUsageSession ? formatDateTime(latestUsageSession.started_at, locale) : "-"} />
          </dl>

          {usageSessions.length > 0 ? (
            <div className="mt-5 space-y-3">
              {usageSessions.slice(0, 8).map((session) => (
                <div key={session.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-950">{session.device_id}</p>
                      <p className="mt-1 font-mono text-xs text-slate-600">{shortHash(session.machine_code_hash)} / {shortId(session.desktop_session_id)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">{formatUsageDuration(usageSeconds(session))}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{t("cloudSyncUsageStarted")}: {formatDateTime(session.started_at, locale)}</p>
                  <p className="mt-1 text-xs text-slate-600">{t("cloudSyncUsageLastHeartbeat")}: {formatDateTime(session.last_heartbeat_at, locale)}</p>
                  <p className="mt-1 text-xs text-slate-600">{t("cloudSyncUsageEnded")}: {formatDateTime(session.ended_at, locale)}</p>
                  <p className="mt-1 text-xs text-slate-600">{t("cloudSyncUsageEndReason")}: {session.end_reason ?? t("cloudSyncUsageStillActive")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">{t("cloudSyncUsageEmpty")}</p>
          )}

          {usageEvents.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-950">{t("cloudSyncUsageEvents")}</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {usageEvents.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-950">{event.event_type}</p>
                    <p className="mt-1">{formatDateTime(event.occurred_at, locale)}</p>
                    <p className="mt-1 break-words">{event.device_id ?? "-"} / {shortHash(event.machine_code_hash)}</p>
                    {event.reason ? <p className="mt-1">{event.reason}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </AdminCard>

        <AdminCard className="mt-6 p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("timelineTitle")}</h2>
          {timelineItems.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {timelineItems.map((item, index) => (
                <li className="relative rounded-lg border border-slate-200 bg-slate-50 p-4" key={`${item.label}-${item.title}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      {item.href ? (
                        <a className="mt-1 block break-words text-sm font-semibold text-slate-950 underline-offset-4 hover:underline" href={item.href}>
                          {item.title}
                        </a>
                      ) : (
                        <p className="mt-1 break-words text-sm font-semibold text-slate-950">{item.title}</p>
                      )}
                      <p className="mt-1 break-words text-xs text-slate-600">{item.detail}</p>
                    </div>
                    <time className="text-right text-xs text-slate-500" dateTime={item.date ?? undefined}>
                      {formatDateTime(item.date, locale)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-600">{t("timelineEmpty")}</p>
          )}
        </AdminCard>

        {canPermanentlyDeleteUser ? (
          <AdminUserDeleteDangerZone
            action={permanentlyDeleteUser}
            email={profile.email}
            labels={{
              acceptedConfirmation: t("acceptedConfirmation"),
              confirmation: t("deleteConfirmation"),
              deleting: t("deleting"),
              description: t("dangerDescription"),
              hint: profile.email,
              submit: t("permanentDelete"),
              title: t("dangerZone"),
              warning: t("dangerWarning"),
            }}
            locale={locale}
            userId={profile.id}
          />
        ) : null}
      </section>
    </AdminShell>
  );
}
