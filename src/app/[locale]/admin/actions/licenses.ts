"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { decryptLicenseCode, encryptLicenseCode, generateLicenseCode, getLicenseCodeEncryptionKey, maskLicenseCode, type EncryptedLicenseCode } from "@/lib/license/license-codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { getRequiredString, getSafeLocale, getTrialDays, MAX_TRIAL_LABEL_LENGTH } from "./validation";

const CLOUD_SYNC_COOLDOWN_SETTING_KEY = "cloud_sync_device_switch_cooldown_minutes";

function getOptionalReason(formData: FormData, fallback: string) {
  return String(formData.get("reason") ?? "").trim() || fallback;
}

function getCooldownMinutes(formData: FormData) {
  const raw = Number.parseInt(String(formData.get("cooldown_minutes") ?? ""), 10);

  if (!Number.isInteger(raw) || raw < 0 || raw > 10080) {
    throw new Error("Cooldown minutes must be between 0 and 10080");
  }

  return raw;
}

export async function createTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const trialDays = getTrialDays(formData);
  const code = generateLicenseCode();
  const supabase = createSupabaseAdminClient();
  const encryptedCode = encryptLicenseCode(code, getLicenseCodeEncryptionKey());
  const { data: trialCode, error } = await supabase.from("trial_codes").insert({
    code_hash: await hashDesktopSecret(code, "trial_code"),
    code_mask: maskLicenseCode(code),
    created_by: admin.id,
    duration_kind: "trial_3_day",
    encrypted_code_algorithm: encryptedCode.algorithm,
    encrypted_code_ciphertext: encryptedCode.ciphertext,
    encrypted_code_iv: encryptedCode.iv,
    encrypted_code_tag: encryptedCode.tag,
    feature_code: CLOUD_SYNC_FEATURE,
    is_active: true,
    label,
    max_redemptions: 1,
    trial_days: trialDays,
  }).select("id,code_mask,label,trial_days").single();

  if (error || !trialCode) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "trial-code-create-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "create_trial_code",
    adminUserId: admin.id,
    after: {
      code_mask: trialCode.code_mask,
      label: trialCode.label,
      trial_days: trialCode.trial_days,
    },
    reason: "Created trial code",
    targetId: trialCode.id,
    targetType: "trial_code",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "trial-code-created",
    locale,
    tone: "notice",
  });
}

export async function generateLicenseCodeBatch(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  throw new Error("Batch license code generation is disabled. Create one trial code at a time.");
}

export async function revealLicenseCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "License code is required");
  const supabase = createSupabaseAdminClient();
  const { data: trialCode, error } = await supabase
    .from("trial_codes")
    .select("id,encrypted_code_algorithm,encrypted_code_ciphertext,encrypted_code_iv,encrypted_code_tag")
    .eq("id", trialCodeId)
    .single();

  if (error || !trialCode?.encrypted_code_ciphertext || !trialCode.encrypted_code_iv || !trialCode.encrypted_code_tag) {
    throw new Error("License code cannot be revealed");
  }

  const code = decryptLicenseCode({
    algorithm: trialCode.encrypted_code_algorithm as EncryptedLicenseCode["algorithm"],
    ciphertext: trialCode.encrypted_code_ciphertext,
    iv: trialCode.encrypted_code_iv,
    tag: trialCode.encrypted_code_tag,
  }, getLicenseCodeEncryptionKey());

  await insertAdminAuditLog({
    action: "reveal_license_code",
    adminUserId: admin.id,
    reason: "Revealed encrypted license code",
    targetId: trialCodeId,
    targetType: "trial_code",
  });

  return { code };
}

export async function bulkDeleteLicenseCodes(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  throw new Error("Bulk license code actions are disabled. Edit one trial code at a time.");
}

export async function bulkAdjustLicenseDuration(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  throw new Error("Bulk duration adjustments are disabled. Edit one trial code at a time.");
}

export async function setTrialCodeActive(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const isActive = String(formData.get("is_active") ?? "false") === "true";
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("trial_codes")
    .select("is_active")
    .eq("id", trialCodeId)
    .single();
  const { error } = await supabase
    .from("trial_codes")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", trialCodeId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "trial-code-status-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "set_trial_code_active",
    adminUserId: admin.id,
    after: { is_active: isActive },
    before: before ?? null,
    reason: isActive ? "Activated trial code" : "Deactivated trial code",
    targetId: trialCodeId,
    targetType: "trial_code",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "trial-code-status-updated",
    locale,
    tone: "notice",
  });
}

export async function deleteTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("trial_codes")
    .select("code_mask,is_active,label,trial_days")
    .eq("id", trialCodeId)
    .single();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("trial_codes")
    .update({
      deleted_at: now,
      is_active: false,
      updated_at: now,
      updated_by: admin.id,
    })
    .eq("id", trialCodeId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "trial-code-delete-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "delete_trial_code",
    adminUserId: admin.id,
    after: {
      deleted_at: now,
      is_active: false,
      updated_by: admin.id,
    },
    before: before ?? null,
    reason: "Soft-deleted trial code",
    targetId: trialCodeId,
    targetType: "trial_code",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "trial-code-deleted",
    locale,
    tone: "notice",
  });
}

export async function updateTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const trialDays = getTrialDays(formData);
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("trial_codes")
    .select("label,trial_days")
    .eq("id", trialCodeId)
    .single();
  const { error } = await supabase
    .from("trial_codes")
    .update({
      label,
      trial_days: trialDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trialCodeId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "trial-code-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_trial_code",
    adminUserId: admin.id,
    after: { label, trial_days: trialDays },
    before: before ?? null,
    reason: "Updated trial code",
    targetId: trialCodeId,
    targetType: "trial_code",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "trial-code-updated",
    locale,
    tone: "notice",
  });
}

export async function updateCloudSyncCooldownSetting(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const cooldownMinutes = getCooldownMinutes(formData);
  const reason = getOptionalReason(formData, "Updated cloud sync device switch cooldown");
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("cloud_sync_settings")
    .select("key,value")
    .eq("key", CLOUD_SYNC_COOLDOWN_SETTING_KEY)
    .single();
  const now = new Date().toISOString();
  const { error } = await supabase.from("cloud_sync_settings").upsert({
    key: CLOUD_SYNC_COOLDOWN_SETTING_KEY,
    updated_at: now,
    updated_by: admin.id,
    value: String(cooldownMinutes),
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/licenses",
      formData,
      key: "cloud-sync-cooldown-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_cloud_sync_cooldown_setting",
    adminUserId: admin.id,
    after: { value: String(cooldownMinutes) },
    before: before ?? null,
    reason,
    targetId: CLOUD_SYNC_COOLDOWN_SETTING_KEY,
    targetType: "cloud_sync_setting",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/licenses",
    formData,
    key: "cloud-sync-cooldown-updated",
    locale,
    tone: "notice",
  });
}
