"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { hashDesktopSecret } from "@/lib/license/hash";
import {
  assertLicenseCode,
  decryptLicenseCode,
  encryptLicenseCode,
  generateLicenseCode,
  getLicenseCodeEncryptionKey,
  getLicenseDurationDays,
  isLicenseDurationKind,
  maskLicenseCode,
  type EncryptedLicenseCode,
  type LicenseDurationKind,
} from "@/lib/license/license-codes";
import { SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

const MAX_REASON_LENGTH = 500;
const MAX_MANUAL_REFERENCE_LENGTH = 120;
const MAX_RELEASE_NOTES_LENGTH = 4000;
const MAX_TRIAL_LABEL_LENGTH = 120;
const MAX_TRIAL_DAYS = 365;
const MAX_NOTIFICATION_TITLE_LENGTH = 160;
const MAX_NOTIFICATION_BODY_LENGTH = 4000;
const MAX_LICENSE_BATCH_SIZE = 200;
const notificationAudiences = ["all", "authenticated", "admins"] as const;
const notificationPriorities = ["info", "success", "warning", "critical"] as const;
const feedbackStatuses = ["open", "reviewing", "closed"] as const;

function getSafeLocale(locale: FormDataEntryValue | null) {
  const value = String(locale ?? "en");

  return supportedLocales.includes(value as Locale) ? value : "en";
}

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getPositiveInteger(formData: FormData, key: string, message: string) {
  const value = Number(formData.get(key));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

function getTrialDays(formData: FormData) {
  const value = getPositiveInteger(formData, "trial_days", "Trial days must be between 1 and 365");

  if (value > MAX_TRIAL_DAYS) {
    throw new Error("Trial days must be between 1 and 365");
  }

  return value;
}

function getOptionalPositiveInteger(formData: FormData, key: string, message: string) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

function getOptionalDateIso(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date.toISOString();
}

function getRequiredReason(formData: FormData) {
  const reason = getRequiredString(formData, "reason", "Reason is required");

  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error("Reason must be 500 characters or fewer");
  }

  return reason;
}

function getBoundedString(formData: FormData, key: string, message: string, maxLength: number) {
  const value = getRequiredString(formData, key, message);

  if (value.length > maxLength) {
    throw new Error(`${message} must be ${maxLength} characters or fewer`);
  }

  return value;
}

async function insertAdminAuditLog(input: {
  action: string;
  adminUserId: string;
  after?: Json;
  before?: Json;
  reason: string;
  targetId: string;
  targetType: string;
}) {
  const { error } = await createSupabaseAdminClient().from("admin_audit_logs").insert({
    action: input.action,
    admin_user_id: input.adminUserId,
    after: input.after ?? null,
    before: input.before ?? null,
    reason: input.reason,
    target_id: input.targetId,
    target_type: input.targetType,
  });

  if (error) {
    throw new Error("Unable to write audit log");
  }
}

function getManualReference(formData: FormData) {
  const reference = getRequiredString(formData, "reference", "Reference is required");

  if (reference.length > MAX_MANUAL_REFERENCE_LENGTH) {
    throw new Error("Reference must be 120 characters or fewer");
  }

  return `manual_${reference.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
}

function getReleaseDate(formData: FormData) {
  const date = getRequiredString(formData, "released_at", "Release date is required");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Release date must use YYYY-MM-DD");
  }

  return date;
}

function getReleaseNotes(formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim();

  if (notes.length > MAX_RELEASE_NOTES_LENGTH) {
    throw new Error("Release notes must be 4000 characters or fewer");
  }

  return notes || null;
}

function getUploadFile(formData: FormData, key: string) {
  const file = formData.get(key);

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  return file;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/\s+/g, "-");
}

export async function addManualDonation(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const providerTransactionId = getManualReference(formData);
  const userIdentifier = getRequiredString(formData, "user_identifier", "User is required");
  const amount = Number(formData.get("amount"));

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number of cents");
  }

  const supabase = createSupabaseAdminClient();
  const lookupColumn = userIdentifier.includes("@") ? "email" : "id";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .eq(lookupColumn, userIdentifier)
    .single();

  if (profileError || !profile) {
    throw new Error("User not found");
  }

  const { data: donationId, error: donationError } = await supabase.rpc("create_manual_paid_donation_with_audit", {
    input_admin_user_id: admin.id,
    input_amount: amount,
    input_currency: "usd",
    input_provider_transaction_id: providerTransactionId,
    input_reason: reason,
    input_user_id: profile.id,
  });

  if (donationError || !donationId) {
    throw new Error("Unable to create manual donation");
  }

  await generateCertificatesForDonation(donationId);
  await extendCloudSyncEntitlementForDonation(supabase, {
    userId: profile.id,
    donationId,
    tierCode: "yearly",
    paidAt: new Date(),
  });

  revalidatePath(`/${locale}/admin/donations`);
  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}

export async function createNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const title = getBoundedString(formData, "title", "Title is required", MAX_NOTIFICATION_TITLE_LENGTH);
  const body = getBoundedString(formData, "body", "Body is required", MAX_NOTIFICATION_BODY_LENGTH);
  const notificationLocale = String(formData.get("notification_locale") ?? "").trim();
  const audience = getRequiredString(formData, "audience", "Audience is required");
  const priority = getRequiredString(formData, "priority", "Priority is required");
  const expiresAt = getOptionalDateIso(formData, "expires_at");
  const shouldPublish = formData.get("publish_now") === "on";

  if (!notificationAudiences.includes(audience as (typeof notificationAudiences)[number])) {
    throw new Error("Invalid audience");
  }

  if (!notificationPriorities.includes(priority as (typeof notificationPriorities)[number])) {
    throw new Error("Invalid priority");
  }

  if (notificationLocale && !supportedLocales.includes(notificationLocale as Locale)) {
    throw new Error("Invalid locale");
  }

  const safeNotificationLocale = notificationLocale ? (notificationLocale as Locale) : null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notifications").insert({
    audience: audience as (typeof notificationAudiences)[number],
    body,
    created_by: admin.id,
    expires_at: expiresAt,
    locale: safeNotificationLocale,
    priority: priority as (typeof notificationPriorities)[number],
    published_at: shouldPublish ? new Date().toISOString() : null,
    title,
  });

  if (error) {
    throw new Error("Unable to create notification");
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
}

export async function publishNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const notificationId = getRequiredString(formData, "notification_id", "Notification is required");
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    throw new Error("Unable to publish notification");
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
}

export async function unpublishNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const notificationId = getRequiredString(formData, "notification_id", "Notification is required");
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .update({ published_at: null, updated_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    throw new Error("Unable to unpublish notification");
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
}

export async function updateSupportFeedbackStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const feedbackId = getRequiredString(formData, "feedback_id", "Feedback is required");
  const status = getRequiredString(formData, "status", "Status is required");

  if (!feedbackStatuses.includes(status as (typeof feedbackStatuses)[number])) {
    throw new Error("Invalid feedback status");
  }

  const { error } = await createSupabaseAdminClient()
    .from("support_feedback")
    .update({
      closed_at: status === "closed" ? new Date().toISOString() : null,
      status: status as (typeof feedbackStatuses)[number],
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    throw new Error("Unable to update feedback");
  }

  revalidatePath(`/${locale}/admin/support-feedback`);
  revalidatePath(`/${locale}/admin/support-feedback/${feedbackId}`);
  revalidatePath(`/${locale}/support/feedback/${feedbackId}`);
}

export async function replySupportFeedbackAsAdmin(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const feedbackId = getRequiredString(formData, "feedback_id", "Feedback is required");
  const message = getBoundedString(formData, "message", "Message is required", MAX_NOTIFICATION_BODY_LENGTH);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("support_feedback_messages").insert({
    admin_user_id: admin.id,
    author_role: "admin",
    body: message,
    feedback_id: feedbackId,
  });

  if (error) {
    throw new Error("Unable to reply to feedback");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("support_feedback")
    .update({ status: "reviewing", updated_at: now })
    .eq("id", feedbackId);

  if (updateError) {
    throw new Error("Unable to update feedback");
  }

  await insertAdminAuditLog({
    action: "reply_support_feedback",
    adminUserId: admin.id,
    reason: "Admin replied to support feedback",
    targetId: feedbackId,
    targetType: "support_feedback",
  });

  revalidatePath(`/${locale}/admin/support-feedback`);
  revalidatePath(`/${locale}/admin/support-feedback/${feedbackId}`);
}

export async function revokeCertificate(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const certificateId = getRequiredString(formData, "certificate_id", "Certificate is required");
  const supabase = createSupabaseAdminClient();

  const { error: revokeError } = await supabase.rpc("revoke_certificate_with_audit", {
    input_admin_user_id: admin.id,
    input_certificate_id: certificateId,
    input_reason: reason,
  });

  if (revokeError) {
    throw new Error("Unable to revoke certificate");
  }

  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}

export async function createSoftwareRelease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const version = getRequiredString(formData, "version", "Version is required");
  const releasedAt = getReleaseDate(formData);
  const notes = getReleaseNotes(formData);
  const files: { platform: ReleasePlatform; file: File }[] = [
    { platform: "macos", file: getUploadFile(formData, "macos_file") as File },
    { platform: "windows", file: getUploadFile(formData, "windows_file") as File },
  ].filter((entry): entry is { platform: ReleasePlatform; file: File } => Boolean(entry.file));

  if (files.length === 0) {
    throw new Error("Upload at least one installer file");
  }

  const supabase = createSupabaseAdminClient();
  const { data: release, error: releaseError } = await supabase
    .from("software_releases")
    .insert({
      created_by: admin.id,
      is_published: formData.get("is_published") === "on",
      notes,
      released_at: releasedAt,
      version,
    })
    .select("id")
    .single();

  if (releaseError || !release) {
    throw new Error("Unable to create software release");
  }

  const assets = [];

  for (const { platform, file } of files) {
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `${release.id}/${platform}/${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from(SOFTWARE_RELEASES_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      throw new Error(`Unable to upload ${platform} installer`);
    }

    assets.push({
      file_name: file.name,
      file_size: file.size,
      platform,
      release_id: release.id,
      storage_path: storagePath,
    });
  }

  const { error: assetError } = await supabase.from("software_release_assets").insert(assets);

  if (assetError) {
    throw new Error("Unable to save release assets");
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/versions`);
  revalidatePath(`/${locale}/admin/releases`);
}

export async function setSoftwareReleasePublished(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const releaseId = getRequiredString(formData, "release_id", "Release is required");
  const isPublished = String(formData.get("is_published") ?? "false") === "true";
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("software_releases").update({ is_published: isPublished }).eq("id", releaseId);

  if (error) {
    throw new Error("Unable to update release status");
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/versions`);
  revalidatePath(`/${locale}/admin/releases`);
}

export async function createTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const code = assertLicenseCode(getRequiredString(formData, "code", "Trial code is required"));
  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const trialDays = getTrialDays(formData);
  const maxRedemptions = getOptionalPositiveInteger(
    formData,
    "max_redemptions",
    "Max redemptions must be a positive integer",
  );
  const supabase = createSupabaseAdminClient();
  const encryptedCode = encryptLicenseCode(code, getLicenseCodeEncryptionKey());
  const { error } = await supabase.from("trial_codes").insert({
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
    max_redemptions: maxRedemptions,
    trial_days: trialDays,
  });

  if (error) {
    throw new Error("Unable to create trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

function getLicenseDurationKind(formData: FormData): LicenseDurationKind {
  const durationKind = getRequiredString(formData, "duration_kind", "Duration is required");

  if (!isLicenseDurationKind(durationKind)) {
    throw new Error("Invalid license duration");
  }

  return durationKind;
}

function getSelectedLicenseCodeIds(formData: FormData) {
  return formData.getAll("trial_code_id").map((value) => String(value).trim()).filter(Boolean);
}

export async function generateLicenseCodeBatch(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const durationKind = getLicenseDurationKind(formData);

  if (durationKind === "trial_3_day") {
    throw new Error("3-day trial codes are created manually");
  }

  const quantity = getPositiveInteger(formData, "quantity", "Quantity must be a positive integer");

  if (quantity > MAX_LICENSE_BATCH_SIZE) {
    throw new Error("Quantity must be 200 or fewer");
  }

  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const batchId = randomUUID();
  const key = getLicenseCodeEncryptionKey();
  const trialDays = getLicenseDurationDays(durationKind);
  const codes = Array.from({ length: quantity }, () => generateLicenseCode());
  const rows = await Promise.all(codes.map(async (code) => {
    const encryptedCode = encryptLicenseCode(code, key);

    return {
      batch_id: batchId,
      code_hash: await hashDesktopSecret(code, "trial_code"),
      code_mask: maskLicenseCode(code),
      created_by: admin.id,
      duration_kind: durationKind,
      encrypted_code_algorithm: encryptedCode.algorithm,
      encrypted_code_ciphertext: encryptedCode.ciphertext,
      encrypted_code_iv: encryptedCode.iv,
      encrypted_code_tag: encryptedCode.tag,
      feature_code: CLOUD_SYNC_FEATURE,
      is_active: true,
      label,
      max_redemptions: 1,
      trial_days: trialDays,
    };
  }));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("trial_codes").insert(rows);

  if (error) {
    throw new Error("Unable to generate license codes");
  }

  await insertAdminAuditLog({
    action: "generate_license_codes",
    adminUserId: admin.id,
    after: { batch_id: batchId, duration_kind: durationKind, quantity },
    reason: "Generated license code batch",
    targetId: batchId,
    targetType: "license_code_batch",
  });

  revalidatePath(`/${locale}/admin/licenses`);
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
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const ids = getSelectedLicenseCodeIds(formData);

  if (ids.length === 0) {
    throw new Error("Select at least one license code");
  }

  const now = new Date().toISOString();
  const { error } = await createSupabaseAdminClient()
    .from("trial_codes")
    .update({ deleted_at: now, is_active: false, updated_at: now, updated_by: admin.id })
    .in("id", ids);

  if (error) {
    throw new Error("Unable to delete license codes");
  }

  await insertAdminAuditLog({
    action: "bulk_delete_license_codes",
    adminUserId: admin.id,
    after: { ids },
    reason,
    targetId: ids[0],
    targetType: "trial_codes",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}

export async function bulkAdjustLicenseDuration(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const ids = getSelectedLicenseCodeIds(formData);
  const deltaDays = Number(formData.get("delta_days"));

  if (ids.length === 0) {
    throw new Error("Select at least one license code");
  }

  if (!Number.isInteger(deltaDays) || deltaDays === 0 || Math.abs(deltaDays) > 3650) {
    throw new Error("Adjustment must be between -3650 and 3650 days");
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { data: trialCodes, error: readError } = await supabase
    .from("trial_codes")
    .select("id,trial_days")
    .in("id", ids);

  if (readError || !trialCodes) {
    throw new Error("Unable to read license codes");
  }

  await Promise.all(trialCodes.map(async (trialCode) => {
    const trialDays = Math.max(1, Math.min(MAX_TRIAL_DAYS, trialCode.trial_days + deltaDays));
    const { error } = await supabase
      .from("trial_codes")
      .update({ trial_days: trialDays, updated_at: now, updated_by: admin.id })
      .eq("id", trialCode.id);

    if (error) {
      throw new Error("Unable to adjust license codes");
    }
  }));

  const { data: redemptions, error: redemptionError } = await supabase
    .from("trial_code_redemptions")
    .select("id,trial_valid_until,user_id")
    .in("trial_code_id", ids);

  if (redemptionError) {
    throw new Error("Unable to read redemptions");
  }

  await Promise.all((redemptions ?? []).map(async (redemption) => {
    const validUntil = new Date(redemption.trial_valid_until);
    validUntil.setUTCDate(validUntil.getUTCDate() + deltaDays);
    const nextValidUntil = validUntil.toISOString();
    const { error: redemptionUpdateError } = await supabase
      .from("trial_code_redemptions")
      .update({ trial_valid_until: nextValidUntil })
      .eq("id", redemption.id);

    if (redemptionUpdateError) {
      throw new Error("Unable to update redemptions");
    }

    const { error: entitlementError } = await supabase
      .from("license_entitlements")
      .update({ updated_at: now, valid_until: nextValidUntil })
      .eq("user_id", redemption.user_id)
      .eq("feature_code", CLOUD_SYNC_FEATURE);

    if (entitlementError) {
      throw new Error("Unable to update entitlements");
    }
  }));

  await insertAdminAuditLog({
    action: "bulk_adjust_license_duration",
    adminUserId: admin.id,
    after: { delta_days: deltaDays, ids },
    reason,
    targetId: ids[0],
    targetType: "trial_codes",
  });

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}

export async function setTrialCodeActive(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const isActive = String(formData.get("is_active") ?? "false") === "true";
  const { error } = await createSupabaseAdminClient()
    .from("trial_codes")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", trialCodeId);

  if (error) {
    throw new Error("Unable to update trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function updateTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const trialDays = getTrialDays(formData);
  const maxRedemptions = getOptionalPositiveInteger(
    formData,
    "max_redemptions",
    "Max redemptions must be a positive integer",
  );
  const { error } = await createSupabaseAdminClient()
    .from("trial_codes")
    .update({
      label,
      max_redemptions: maxRedemptions,
      trial_days: trialDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trialCodeId);

  if (error) {
    throw new Error("Unable to update trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function revokeDesktopSession(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const desktopSessionId = getRequiredString(formData, "desktop_session_id", "Desktop session is required");
  const { error } = await createSupabaseAdminClient().rpc("revoke_desktop_session_with_leases", {
    input_desktop_session_id: desktopSessionId,
    input_now: new Date().toISOString(),
  });

  if (error) {
    throw new Error("Unable to revoke desktop session");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function revokeCloudSyncLease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const cloudSyncLeaseId = getRequiredString(formData, "cloud_sync_lease_id", "Cloud sync lease is required");
  const now = new Date().toISOString();
  const { error } = await createSupabaseAdminClient()
    .from("cloud_sync_leases")
    .update({ revoked_at: now, updated_at: now })
    .eq("id", cloudSyncLeaseId);

  if (error) {
    throw new Error("Unable to revoke cloud sync lease");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function updateUserAccountStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const accountStatus = getRequiredString(formData, "account_status", "Account status is required");

  if (accountStatus !== "active" && accountStatus !== "disabled") {
    throw new Error("Invalid account status");
  }

  const { error } = await createSupabaseAdminClient()
    .from("profiles")
    .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error("Unable to update account status");
  }

  revalidatePath(`/${locale}/admin/users`);
}

export async function updateUserAdminRole(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireOwner(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const adminRole = getRequiredString(formData, "admin_role", "Admin role is required");

  if (adminRole !== "owner" && adminRole !== "operator" && adminRole !== "user") {
    throw new Error("Invalid admin role");
  }

  const { error } = await createSupabaseAdminClient()
    .from("profiles")
    .update({
      admin_role: adminRole,
      is_admin: adminRole === "owner",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error("Unable to update admin role");
  }

  revalidatePath(`/${locale}/admin/users`);
}

export async function unbindTrialMachine(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const redemptionId = getRequiredString(formData, "trial_redemption_id", "Trial redemption is required");
  const supabase = createSupabaseAdminClient();
  const { data: redemption, error: readError } = await supabase
    .from("trial_code_redemptions")
    .select("id,machine_code_hash")
    .eq("id", redemptionId)
    .single();

  if (readError || !redemption) {
    throw new Error("Trial redemption not found");
  }

  if (redemption.machine_code_hash) {
    const { error: claimError } = await supabase
      .from("machine_trial_claims")
      .delete()
      .eq("machine_code_hash", redemption.machine_code_hash)
      .eq("feature_code", CLOUD_SYNC_FEATURE);

    if (claimError) {
      throw new Error("Unable to remove machine trial claim");
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
    throw new Error("Unable to unbind trial machine");
  }

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/licenses`);
}
