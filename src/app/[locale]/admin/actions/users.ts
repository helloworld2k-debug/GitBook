"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { getRequiredString, getSafeLocale, getUserIds } from "./validation";

function getRequiredFutureDate(formData: FormData, name: string) {
  const value = getRequiredString(formData, name, "Expiry is required");
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    throw new Error("Expiry must be a future date");
  }

  return date.toISOString();
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
  const { error } = await createSupabaseAdminClient()
    .from("cloud_sync_leases")
    .update({ revoked_at: now, updated_at: now })
    .eq("id", cloudSyncLeaseId);

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
  const supabase = createSupabaseAdminClient();
  const { data: override, error } = await supabase
    .from("cloud_sync_cooldown_overrides")
    .insert({
      created_by: admin.id,
      expires_at: expiresAt,
      reason,
      user_id: userId,
    })
    .select("id,user_id,expires_at")
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
    action: "grant_cloud_sync_cooldown_override",
    adminUserId: admin.id,
    after: {
      expires_at: override.expires_at,
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

  if (intent === "enable" || intent === "disable" || intent === "soft-delete") {
    const admin = await requireAdmin(locale);
    const accountStatus = intent === "enable" ? "active" : intent === "disable" ? "disabled" : "deleted";
    const supabase = createSupabaseAdminClient();
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
  const admin = await requireOwner(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const confirmation = getRequiredString(formData, "confirmation", "Confirmation is required");
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("email").eq("id", userId).single();

  if (profileError || !profile) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/users",
      formData,
      key: "user-permanent-delete-failed",
      locale,
      tone: "error",
    });
  }

  if (confirmation !== "DELETE" && confirmation !== profile.email) {
    throw new Error("Confirmation does not match");
  }

  const { error } = await supabase.from("profiles").delete().eq("id", userId);

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
