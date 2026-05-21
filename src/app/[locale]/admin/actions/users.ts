"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { insertAdminAuditLog } from "./audit";
import { getRequiredString, getSafeLocale, getUserIds } from "./validation";

type CloudSyncCooldownOverrideInsert = Database["public"]["Tables"]["cloud_sync_cooldown_overrides"]["Insert"];
type AdminRole = Database["public"]["Tables"]["profiles"]["Row"]["admin_role"];

function isOwnerUser(profile: { admin_role?: string | null; is_admin?: boolean | null }) {
  return profile.is_admin === true || profile.admin_role === "owner";
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function getAuthCallbackUrl(locale: string, nextPath = `/${locale}/dashboard`) {
  const callbackUrl = new URL("/auth/callback", getSiteUrl());
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

function getPasswordResetCallbackUrl(locale: string) {
  return getAuthCallbackUrl(locale, `/${locale}/reset-password`);
}

function getAdminRole(formData: FormData) {
  const role = String(formData.get("admin_role") ?? "user").trim() || "user";

  if (role !== "owner" && role !== "operator" && role !== "user") {
    throw new Error("Invalid admin role");
  }

  return role as AdminRole;
}

async function requireAdminForRole(locale: string, role: AdminRole) {
  return role === "user" ? requireAdmin(locale) : requireOwner(locale);
}

async function updateCreatedUserProfile(input: {
  displayName: string | null;
  role: AdminRole;
  userId: string;
}) {
  const { error } = await createSupabaseAdminClient()
    .from("profiles")
    .update({
      admin_role: input.role,
      display_name: input.displayName,
      is_admin: input.role === "owner",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  return error;
}

async function getProfileEmail(userId: string) {
  return createSupabaseAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
}

export async function inviteUserAccount(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const role = getAdminRole(formData);
  const admin = await requireAdminForRole(locale, role);
  const email = getRequiredString(formData, "email", "Email is required").toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const supabase = createSupabaseAdminClient();
  const result = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: displayName,
      source: "admin_invite",
    },
    redirectTo: getAuthCallbackUrl(locale),
  });
  const userId = result.data.user?.id;

  if (result.error || !userId) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-invite-failed",
      locale,
      tone: "error",
    });
  }

  const profileError = await updateCreatedUserProfile({ displayName, role, userId });

  if (profileError) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-invite-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "invite_user",
    adminUserId: admin.id,
    after: { admin_role: role, email },
    reason: "Invited user from admin console",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "user-invited",
    locale,
    tone: "notice",
  });
}

export async function createUserWithTemporaryPassword(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const role = getAdminRole(formData);
  const admin = await requireAdminForRole(locale, role);
  const email = getRequiredString(formData, "email", "Email is required").toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const password = getRequiredString(formData, "password", "Temporary password is required");
  const supabase = createSupabaseAdminClient();
  const result = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      display_name: displayName,
      source: "admin_temp_password",
    },
  });
  const userId = result.data.user?.id;

  if (result.error || !userId) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-create-temp-password-failed",
      locale,
      tone: "error",
    });
  }

  const profileError = await updateCreatedUserProfile({ displayName, role, userId });

  if (profileError) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-create-temp-password-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "create_user_with_temp_password",
    adminUserId: admin.id,
    after: { admin_role: role, email, email_confirm: true },
    reason: "Created user with temporary password from admin console",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "user-created-with-temp-password",
    locale,
    tone: "notice",
  });
}

export async function sendUserPasswordSetupEmail(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await getProfileEmail(userId);

  if (profileError || !profile?.email) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "user-password-setup-failed",
      locale,
      tone: "error",
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: getPasswordResetCallbackUrl(locale),
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "user-password-setup-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "send_user_password_setup",
    adminUserId: admin.id,
    after: { email: profile.email },
    reason: "Sent password setup email from admin console",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/users/${userId}`,
    formData,
    key: "user-password-setup-sent",
    locale,
    tone: "notice",
  });
}

export async function setUserTemporaryPassword(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const password = getRequiredString(formData, "password", "Temporary password is required");
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await getProfileEmail(userId);

  if (profileError || !profile?.email) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "user-temp-password-set-failed",
      locale,
      tone: "error",
    });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password,
    user_metadata: {
      source: "admin_temp_password_reset",
    },
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "user-temp-password-set-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "set_user_temp_password",
    adminUserId: admin.id,
    after: { email: profile.email, email_confirm: true },
    reason: "Set user temporary password from admin console",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/users/${userId}`,
    formData,
    key: "user-temp-password-set",
    locale,
    tone: "notice",
  });
}

function getRequiredFutureDate(formData: FormData, name: string) {
  const value = getRequiredString(formData, name, "Expiry is required");
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    throw new Error("Expiry must be a future date");
  }

  return date.toISOString();
}

function getCloudSyncOverrideType(formData: FormData) {
  const value = String(formData.get("override_type") ?? "skip_cooldown").trim();

  if (value !== "skip_cooldown" && value !== "force_switch") {
    throw new Error("Invalid cloud sync override type");
  }

  return value;
}

export async function updateAdminUserProfile(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const publicDisplayName = String(formData.get("public_display_name") ?? "").trim() || null;
  const publicSupporterEnabled = formData.get("public_supporter_enabled") === "on";

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("display_name,public_display_name,public_supporter_enabled")
    .eq("id", userId)
    .single();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      public_display_name: publicDisplayName,
      public_supporter_enabled: publicSupporterEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "profile-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_user_profile",
    adminUserId: admin.id,
    after: {
      display_name: displayName,
      public_display_name: publicDisplayName,
      public_supporter_enabled: publicSupporterEnabled,
    },
    before: before ?? null,
    reason: "Updated user profile from admin console",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/users/${userId}`,
    formData,
    key: "account-profile-updated",
    locale,
    tone: "notice",
  });
}

export async function revokeDesktopSession(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const desktopSessionId = getRequiredString(formData, "desktop_session_id", "Desktop session is required");
  const { error } = await createSupabaseAdminClient().rpc("revoke_desktop_session_with_leases", {
    input_desktop_session_id: desktopSessionId,
    input_now: new Date().toISOString(),
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "desktop-session-revoke-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "revoke_desktop_session",
    adminUserId: admin.id,
    reason: "Revoked desktop session from admin console",
    targetId: desktopSessionId,
    targetType: "desktop_session",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "desktop-session-revoked",
    locale,
    tone: "notice",
  });
}

export async function revokeCloudSyncLease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const cloudSyncLeaseId = getRequiredString(formData, "cloud_sync_lease_id", "Cloud sync lease is required");
  const now = new Date().toISOString();
  const { error } = await createSupabaseAdminClient().rpc("revoke_cloud_sync_lease_with_usage", {
    input_cloud_sync_lease_id: cloudSyncLeaseId,
    input_now: now,
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "cloud-sync-lease-revoke-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "revoke_cloud_sync_lease",
    adminUserId: admin.id,
    after: { revoked_at: now },
    reason: "Revoked cloud sync lease from admin console",
    targetId: cloudSyncLeaseId,
    targetType: "cloud_sync_lease",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "cloud-sync-lease-revoked",
    locale,
    tone: "notice",
  });
}

export async function grantCloudSyncCooldownOverride(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const expiresAt = getRequiredFutureDate(formData, "expires_at");
  const reason = getRequiredString(formData, "reason", "Reason is required");
  const overrideType = getCloudSyncOverrideType(formData);
  const targetMachineCodeHash = String(formData.get("target_machine_code_hash") ?? "").trim() || null;
  const targetDeviceId = String(formData.get("target_device_id") ?? "").trim() || null;
  const supabase = createSupabaseAdminClient();
  const overrideInsert: CloudSyncCooldownOverrideInsert = {
    created_by: admin.id,
    expires_at: expiresAt,
    reason,
    user_id: userId,
    ...(overrideType === "force_switch"
      ? {
          override_type: overrideType,
          target_device_id: targetDeviceId,
          target_machine_code_hash: targetMachineCodeHash,
        }
      : {}),
  };
  const { data: override, error } = await supabase
    .from("cloud_sync_cooldown_overrides")
    .insert(overrideInsert)
    .select("id,user_id,expires_at,override_type,target_machine_code_hash,target_device_id")
    .single();

  if (error || !override) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/users/${userId}`,
      formData,
      key: "cloud-sync-override-grant-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: overrideType === "force_switch" ? "grant_cloud_sync_force_switch_override" : "grant_cloud_sync_cooldown_override",
    adminUserId: admin.id,
    after: {
      expires_at: override.expires_at,
      override_type: override.override_type,
      target_device_id: override.target_device_id,
      target_machine_code_hash: override.target_machine_code_hash,
      user_id: override.user_id,
    },
    reason,
    targetId: override.id,
    targetType: "cloud_sync_cooldown_override",
  });

  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/users/${userId}`,
    formData,
    key: "cloud-sync-override-granted",
    locale,
    tone: "notice",
  });
}

export async function updateUserAccountStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const accountStatus = getRequiredString(formData, "account_status", "Account status is required");

  if (accountStatus !== "active" && accountStatus !== "disabled" && accountStatus !== "deleted") {
    throw new Error("Invalid account status");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", userId)
    .single();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "status-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_user_account_status",
    adminUserId: admin.id,
    after: { account_status: accountStatus },
    before: before ?? null,
    reason: `Updated account status to ${accountStatus}`,
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "status-updated",
    locale,
    tone: "notice",
  });
}

export async function softDeleteUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase.from("profiles").select("account_status,email").eq("id", userId).single();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-soft-delete-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "soft_delete_user",
    adminUserId: admin.id,
    after: { account_status: "deleted" },
    before: before ?? null,
    reason: "Soft deleted user from admin list",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "user-soft-deleted",
    locale,
    tone: "notice",
  });
}

export async function bulkProcessUsers(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const intent = getRequiredString(formData, "intent", "Bulk intent is required");
  const userIds = getUserIds(formData);

  if (intent === "enable" || intent === "disable" || intent === "soft-delete" || intent === "archive-delete") {
    const admin = await requireAdmin(locale);
    const accountStatus = intent === "enable" ? "active" : intent === "disable" ? "disabled" : intent === "soft-delete" ? "deleted" : ("archived_deleted" as const);
    const supabase = createSupabaseAdminClient() as any;

    // For archive-delete, we need to copy data to archive table first
    if (intent === "archive-delete") {
      // Check if any emails already exist in archive
      const { data: existingEmails } = await supabase
        .from("deleted_users_archive")
        .select("email")
        .in("email", await supabase
          .from("profiles")
          .select("email")
          .in("id", userIds)
          .then(({ data }) => data?.map((p) => p.email) ?? []));

      if (existingEmails && existingEmails.length > 0) {
        redirectWithAdminFeedback({
          fallbackPath: "/admin/users",
          formData,
          key: "archive-delete-email-exists",
          locale,
          tone: "error",
        });
      }

      // Get user profiles to archive
      const { data: profilesToArchive } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (!profilesToArchive || profilesToArchive.length === 0) {
        redirectWithAdminFeedback({
          fallbackPath: "/admin/users",
          formData,
          key: "archive-delete-failed",
          locale,
          tone: "error",
        });
      }

      // Insert into archive table
      const archiveEntries = profilesToArchive.map((profile) => ({
        original_user_id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        preferred_locale: profile.preferred_locale,
        public_supporter_enabled: profile.public_supporter_enabled,
        public_display_name: profile.public_display_name,
        is_admin: profile.is_admin,
        admin_role: profile.admin_role,
        account_status: profile.account_status,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        deleted_by: admin.id,
        deleted_reason: "Bulk archive delete from admin console",
      }));

      const { error: archiveError } = await supabase
        .from("deleted_users_archive")
        .insert(archiveEntries);

      if (archiveError) {
        redirectWithAdminFeedback({
          fallbackPath: "/admin/users",
          formData,
          key: "archive-delete-failed",
          locale,
          tone: "error",
        });
      }

      // Update profiles to archived_deleted status
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: accountStatus as any, updated_at: new Date().toISOString() })
        .in("id", userIds);

      if (error) {
        redirectWithAdminFeedback({
          fallbackPath: "/admin/users",
          formData,
          key: "archive-delete-failed",
          locale,
          tone: "error",
        });
      }

      await insertAdminAuditLog({
        action: "bulk_archive_delete_users",
        adminUserId: admin.id,
        after: { account_status: accountStatus, count: userIds.length, user_ids: userIds },
        reason: "Bulk archive deleted users",
        targetId: userIds[0],
        targetType: "profile_batch",
      });

      revalidatePath(`/${locale}/admin/users`);
      revalidatePath(`/${locale}/admin/archived-users`);
      revalidatePath(`/${locale}/admin/audit-logs`);
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "users-archived",
        locale,
        tone: "notice",
      });
    }

    // For enable, disable, soft-delete
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
      .in("id", userIds);

    if (error) {
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "bulk-user-status-update-failed",
        locale,
        tone: "error",
      });
    }

    await insertAdminAuditLog({
      action: "bulk_update_user_account_status",
      adminUserId: admin.id,
      after: { account_status: accountStatus, count: userIds.length, user_ids: userIds },
      reason: `Bulk updated account status to ${accountStatus}`,
      targetId: userIds[0],
      targetType: "profile_batch",
    });

    revalidatePath(`/${locale}/admin/users`);
    revalidatePath(`/${locale}/admin/audit-logs`);
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "bulk-user-status-updated",
      locale,
      tone: "notice",
    });
  }

  if (intent === "change-role") {
    const admin = await requireOwner(locale);
    const adminRole = String(formData.get("admin_role") ?? "").trim();

    if (adminRole !== "owner" && adminRole !== "operator" && adminRole !== "user") {
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "bulk-user-role-update-failed",
        locale,
        tone: "error",
      });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        admin_role: adminRole,
        is_admin: adminRole === "owner",
        updated_at: new Date().toISOString(),
      })
      .in("id", userIds);

    if (error) {
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "bulk-user-role-update-failed",
        locale,
        tone: "error",
      });
    }

    await insertAdminAuditLog({
      action: "bulk_update_user_admin_role",
      adminUserId: admin.id,
      after: { admin_role: adminRole, count: userIds.length, user_ids: userIds },
      reason: `Bulk updated user admin role to ${adminRole}`,
      targetId: userIds[0],
      targetType: "profile_batch",
    });

    revalidatePath(`/${locale}/admin/users`);
    revalidatePath(`/${locale}/admin/audit-logs`);
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "bulk-user-role-updated",
      locale,
      tone: "notice",
    });
  }

  throw new Error("Invalid bulk intent");
}

export async function permanentlyDeleteUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  let admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const confirmation = getRequiredString(formData, "confirmation", "Confirmation is required");
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email,admin_role,is_admin")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-permanent-delete-failed",
      locale,
      tone: "error",
    });
  }

  if (isOwnerUser(profile)) {
    admin = await requireOwner(locale);
  }

  if (confirmation !== "DELETE" && confirmation !== profile.email) {
    throw new Error("Confirmation does not match");
  }

  const { error } = await supabase.auth.admin.deleteUser(userId, false);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-permanent-delete-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "permanently_delete_user",
    adminUserId: admin.id,
    before: { email: profile.email },
    reason: "Permanently deleted user from admin detail page",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "user-permanently-deleted",
    locale,
    tone: "notice",
  });
}

export async function updateUserAdminRole(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireOwner(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const adminRole = getRequiredString(formData, "admin_role", "Admin role is required");

  if (adminRole !== "owner" && adminRole !== "operator" && adminRole !== "user") {
    throw new Error("Invalid admin role");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("admin_role,is_admin")
    .eq("id", userId)
    .single();
  const { error } = await supabase
    .from("profiles")
    .update({
      admin_role: adminRole,
      is_admin: adminRole === "owner",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "role-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_user_admin_role",
    adminUserId: admin.id,
    after: {
      admin_role: adminRole,
      is_admin: adminRole === "owner",
    },
    before: before ?? null,
    reason: `Updated user admin role to ${adminRole}`,
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "role-updated",
    locale,
    tone: "notice",
  });
}

export async function unbindTrialMachine(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const redemptionId = getRequiredString(formData, "trial_redemption_id", "Trial redemption is required");
  const supabase = createSupabaseAdminClient();
  const { data: redemption, error: readError } = await supabase
    .from("trial_code_redemptions")
    .select("id,machine_code_hash")
    .eq("id", redemptionId)
    .single();

  if (readError || !redemption) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "trial-machine-unbind-failed",
      locale,
      tone: "error",
    });
  }

  if (redemption.machine_code_hash) {
    const { error: claimError } = await supabase
      .from("machine_trial_claims")
      .delete()
      .eq("machine_code_hash", redemption.machine_code_hash)
      .eq("feature_code", CLOUD_SYNC_FEATURE);

    if (claimError) {
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "trial-machine-unbind-failed",
        locale,
        tone: "error",
      });
    }
  }

  const { error } = await supabase
    .from("trial_code_redemptions")
    .update({
      bound_at: null,
      desktop_session_id: null,
      device_id: null,
      machine_code_hash: null,
    })
    .eq("id", redemptionId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "trial-machine-unbind-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "unbind_trial_machine",
    adminUserId: admin.id,
    before: {
      machine_code_hash: redemption.machine_code_hash,
    },
    reason: "Unbound trial machine from admin console",
    targetId: redemptionId,
    targetType: "trial_code_redemption",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "trial-machine-unbound",
    locale,
    tone: "notice",
  });
}

// Archive delete users (move to deleted_users_archive)
export async function archiveDeleteUsers(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userIds = getUserIds(formData);
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const supabase = createSupabaseAdminClient();

  // Get profiles to archive
  const { data: profiles, error: fetchError } = await supabase
    .from("profiles")
    .select("id,email,display_name,avatar_url,preferred_locale,public_supporter_enabled,public_display_name,is_admin,admin_role,account_status,created_at,updated_at")
    .in("id", userIds);

  if (fetchError || !profiles || profiles.length === 0) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "archive-delete-failed",
      locale,
      tone: "error",
    });
  }

  // Check for owner role (only owners can archive other owners)
  for (const profile of profiles) {
    if (isOwnerUser(profile)) {
      await requireOwner(locale);
    }
  }

  // Insert into archive table
  const archiveRecords = profiles.map((profile) => ({
    original_user_id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    preferred_locale: profile.preferred_locale,
    public_supporter_enabled: profile.public_supporter_enabled,
    public_display_name: profile.public_display_name,
    is_admin: profile.is_admin,
    admin_role: profile.admin_role,
    account_status: profile.account_status,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    deleted_by: admin.id,
    deleted_reason: reason,
  }));

  const { error: archiveError } = await supabase
    .from("deleted_users_archive")
    .insert(archiveRecords);

  if (archiveError) {
    // Check if it's a duplicate email error
    if (archiveError.message?.includes("deleted_users_archive_email_key")) {
      redirectWithAdminFeedback({
        fallbackPath: "/admin/users",
        formData,
        key: "archive-delete-email-exists",
        locale,
        tone: "error",
      });
    }
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "archive-delete-failed",
      locale,
      tone: "error",
    });
  }

  // Update profile status to archived_deleted
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      account_status: "archived_deleted",
      updated_at: new Date().toISOString(),
    })
    .in("id", userIds);

  if (updateError) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "archive-delete-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "archive_delete_users",
    adminUserId: admin.id,
    after: {
      archived_count: userIds.length,
      user_ids: userIds,
      reason,
    },
    before: profiles.map((p) => ({ id: p.id, email: p.email, status: p.account_status })),
    reason: reason || "Archived deleted users",
    targetId: userIds[0],
    targetType: "profile_batch",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/archived-users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/users",
    formData,
    key: "users-archived",
    locale,
    tone: "notice",
  });
}

// Restore archived user
export async function restoreArchivedUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const archiveId = getRequiredString(formData, "archive_id", "Archive ID is required");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("restore_archived_user", {
    input_archive_id: archiveId,
    input_restored_by: admin.id,
  });

  if (error || !data) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "restore-failed",
      locale,
      tone: "error",
    });
  }

  const result = data as { ok: boolean; reason: string; restored_user_id: string } | null;

  if (!result || !result.ok) {
    const keyMap: Record<string, string> = {
      archive_not_found: "restore-not-found",
      email_already_exists: "restore-email-exists",
      auth_user_missing: "restore-auth-missing",
    };
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: keyMap[result.reason] || "restore-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${result.restored_user_id}`);
  revalidatePath(`/${locale}/admin/archived-users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/archived-users",
    formData,
    key: "user-restored",
    locale,
    tone: "notice",
  });
}

// Permanently delete from archive (owner only)
export async function permanentlyDeleteArchivedUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireOwner(locale);
  const archiveId = getRequiredString(formData, "archive_id", "Archive ID is required");
  const confirmation = getRequiredString(formData, "confirmation", "Confirmation is required");
  const supabase = createSupabaseAdminClient();

  // Get archive record to verify email
  const { data: archive, error: fetchError } = await supabase
    .from("deleted_users_archive")
    .select("id,email")
    .eq("id", archiveId)
    .single();

  if (fetchError || !archive) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "archive-not-found",
      locale,
      tone: "error",
    });
  }

  if (confirmation !== "DELETE" && confirmation !== archive.email) {
    throw new Error("Confirmation does not match");
  }

  const { data, error } = await supabase.rpc("permanently_delete_archived_user", {
    input_archive_id: archiveId,
    input_deleted_by: admin.id,
  });

  if (error || !data) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "permanent-delete-failed",
      locale,
      tone: "error",
    });
  }

  const result = data as { ok: boolean; reason: string } | null;

  if (!result || !result.ok) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "permanent-delete-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/archived-users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/archived-users",
    formData,
    key: "archived-user-permanently-deleted",
    locale,
    tone: "notice",
  });
}

// Bulk restore archived users
export async function bulkRestoreArchivedUsers(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const archiveIds = formData.getAll("archive_id").filter(Boolean) as string[];

  if (archiveIds.length === 0) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "no-archives-selected",
      locale,
      tone: "error",
    });
  }

  const supabase = createSupabaseAdminClient();
  let successCount = 0;
  const errors: { archiveId: string; reason: string }[] = [];

  for (const archiveId of archiveIds) {
    const { data, error } = await supabase.rpc("restore_archived_user", {
      input_archive_id: archiveId,
      input_restored_by: admin.id,
    });

    if (error || !data) {
      errors.push({ archiveId, reason: error?.message || "Unknown error" });
      continue;
    }

    const result = data as { ok: boolean; reason: string } | null;
    if (result?.ok) {
      successCount++;
    } else {
      errors.push({ archiveId, reason: result.reason });
    }
  }

  await insertAdminAuditLog({
    action: "bulk_restore_archived_users",
    adminUserId: admin.id,
    after: {
      success_count: successCount,
      error_count: errors.length,
      total_attempted: archiveIds.length,
    },
    before: { archive_ids: archiveIds },
    reason: `Bulk restored archived users: ${successCount} succeeded, ${errors.length} failed`,
    targetId: archiveIds[0],
    targetType: "deleted_users_archive_batch",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/archived-users`);
  revalidatePath(`/${locale}/admin/audit-logs`);

  if (errors.length === 0) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "bulk-restore-success",
      locale,
      tone: "notice",
    });
  }

  if (successCount === 0) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/archived-users",
      formData,
      key: "bulk-restore-failed",
      locale,
      tone: "error",
    });
  }

  redirectWithAdminFeedback({
    fallbackPath: "/admin/archived-users",
    formData,
    key: "bulk-restore-partial",
    locale,
    tone: "notice",
  });
}
