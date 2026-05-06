"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin, requireOwner } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { hashDesktopSecret } from "@/lib/license/hash";
import {
  decryptLicenseCode,
  encryptLicenseCode,
  generateLicenseCode,
  getLicenseCodeEncryptionKey,
  maskLicenseCode,
  type EncryptedLicenseCode,
} from "@/lib/license/license-codes";
import { SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

const MAX_REASON_LENGTH = 500;
const MAX_MANUAL_REFERENCE_LENGTH = 120;
const MAX_RELEASE_NOTES_LENGTH = 4000;
const MAX_TRIAL_LABEL_LENGTH = 120;
const MAX_TRIAL_DAYS = 7;
const MAX_NOTIFICATION_TITLE_LENGTH = 160;
const MAX_NOTIFICATION_BODY_LENGTH = 4000;
const MAX_DONATION_TIER_LABEL_LENGTH = 120;
const MAX_DONATION_TIER_DESCRIPTION_LENGTH = 500;
const notificationAudiences = ["all", "authenticated", "admins"] as const;
const notificationPriorities = ["info", "success", "warning", "critical"] as const;
const feedbackStatuses = ["open", "reviewing", "closed"] as const;
const supportContactChannelIds = ["telegram", "discord", "qq", "email", "wechat"] as const;

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

function getUserIds(formData: FormData) {
  const values = formData.getAll("user_ids").map((value) => String(value).trim()).filter(Boolean);

  if (values.length === 0) {
    throw new Error("At least one user is required");
  }

  return [...new Set(values)];
}

function getPositiveInteger(formData: FormData, key: string, message: string) {
  const value = Number(formData.get(key));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

function getPositiveDollarAmountInCents(formData: FormData, key: string, message: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue || !Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }

  return Math.round(value * 100);
}

function getDiscountPercent(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "0").trim();
  const value = rawValue ? Number(rawValue) : 0;

  if (!Number.isInteger(value) || value < 0 || value >= 100) {
    throw new Error("Discount must be an integer from 0 to 99");
  }

  return value;
}

function getTrialDays(formData: FormData) {
  const value = getPositiveInteger(formData, "trial_days", "Trial days must be between 1 and 7");

  if (value > MAX_TRIAL_DAYS) {
    throw new Error("Trial days must be between 1 and 7");
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

function getReleaseDeliveryMode(formData: FormData) {
  const deliveryMode = getRequiredString(formData, "delivery_mode", "Delivery mode is required");

  if (deliveryMode !== "file" && deliveryMode !== "link") {
    throw new Error("Invalid delivery mode");
  }

  return deliveryMode as "file" | "link";
}

function getOptionalReleaseUrl(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Enter a valid URL");
    }
  } catch {
    throw new Error("Enter a valid URL");
  }

  return value;
}

function getRequiredReleaseUrl(formData: FormData, key: string) {
  const value = getOptionalReleaseUrl(formData, key);

  if (!value) {
    throw new Error("Primary download URL is required");
  }

  return value;
}

function getSupportContactChannelId(formData: FormData) {
  const channelId = getRequiredString(formData, "channel_id", "Channel is required");

  if (!supportContactChannelIds.includes(channelId as (typeof supportContactChannelIds)[number])) {
    throw new Error("Invalid support contact channel");
  }

  return channelId as (typeof supportContactChannelIds)[number];
}

function validateSupportContactValue(channelId: (typeof supportContactChannelIds)[number], value: string) {
  if (!value) {
    return;
  }

  if (channelId === "telegram" || channelId === "discord") {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Enter a valid URL");
      }
    } catch {
      throw new Error("Enter a valid URL");
    }
  }

  if (channelId === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error("Enter a valid email address");
    }
  }
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/donations",
      formData,
      key: "manual-donation-failed",
      locale,
      tone: "error",
    });
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/donations",
      formData,
      key: "manual-donation-failed",
      locale,
      tone: "error",
    });
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
  revalidatePath(`/${locale}/admin/users/${profile.id}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/donations",
    formData,
    key: "manual-donation-added",
    locale,
    tone: "notice",
  });
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-created",
    locale,
    tone: "notice",
  });
}

export async function updateSupportContactChannel(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const channelId = getSupportContactChannelId(formData);
  const value = String(formData.get("value") ?? "").trim();
  const label = getRequiredString(formData, "label", "Label is required");
  const sortOrder = getPositiveInteger(formData, "sort_order", "Sort order must be a positive integer");
  const isEnabled = formData.get("is_enabled") === "on";

  validateSupportContactValue(channelId, value);

  const supabase = createSupabaseAdminClient();
  const { data: existingChannel } = await supabase
    .from("support_contact_channels")
    .select("id")
    .eq("id", channelId)
    .single();

  const { error } = await supabase
    .from("support_contact_channels")
    .upsert({
      id: channelId,
      is_enabled: isEnabled,
      label,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
      value,
    }, { onConflict: "id" });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-settings",
      formData,
      key: "support-contact-update-failed",
      locale,
      tone: "error",
    });
  }

  if (existingChannel?.id === channelId) {
    await insertAdminAuditLog({
      action: "update_support_contact_channel",
      adminUserId: admin.id,
      after: { channel_id: channelId, is_enabled: isEnabled, label, sort_order: sortOrder, value },
      reason: `Updated support contact channel ${channelId}`,
      targetId: "11111111-1111-1111-1111-111111111111",
      targetType: "support_contact_channel",
    });
  }

  revalidatePath(`/${locale}/support`);
  revalidatePath(`/${locale}/admin/support-settings`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-settings",
    formData,
    key: "support-contact-updated",
    locale,
    tone: "notice",
  });
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-published",
    locale,
    tone: "notice",
  });
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-unpublished",
    locale,
    tone: "notice",
  });
}

export async function updateSupportFeedbackStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const feedbackId = getRequiredString(formData, "feedback_id", "Feedback is required");
  const status = getRequiredString(formData, "status", "Status is required");

  if (!feedbackStatuses.includes(status as (typeof feedbackStatuses)[number])) {
    throw new Error("Invalid feedback status");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("support_feedback")
    .select("status")
    .eq("id", feedbackId)
    .single();
  const { error } = await supabase
    .from("support_feedback")
    .update({
      closed_at: status === "closed" ? new Date().toISOString() : null,
      status: status as (typeof feedbackStatuses)[number],
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-feedback",
      formData,
      key: "feedback-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_support_feedback_status",
    adminUserId: admin.id,
    after: { status },
    before: before ?? null,
    reason: `Updated support feedback status to ${status}`,
    targetId: feedbackId,
    targetType: "support_feedback",
  });

  revalidatePath(`/${locale}/admin/support-feedback`);
  revalidatePath(`/${locale}/admin/support-feedback/${feedbackId}`);
  revalidatePath(`/${locale}/support/feedback/${feedbackId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-feedback",
    formData,
    key: "feedback-updated",
    locale,
    tone: "notice",
  });
}

export async function updateDonationTier(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const tierId = getRequiredString(formData, "tier_id", "Donation tier is required");
  const label = getBoundedString(formData, "label", "Tier label", MAX_DONATION_TIER_LABEL_LENGTH);
  const description = getBoundedString(
    formData,
    "description",
    "Tier description",
    MAX_DONATION_TIER_DESCRIPTION_LENGTH,
  );
  const priceAmount = getPositiveDollarAmountInCents(formData, "price", "Price must be a positive dollar amount");
  const discountPercent = getDiscountPercent(formData, "discount_percent");
  const amount = Math.round(priceAmount * (100 - discountPercent) / 100);
  const compareAtAmount = discountPercent > 0 ? priceAmount : null;
  const isActive = formData.get("is_active") === "on";

  if (amount <= 0) {
    throw new Error("Discounted price must be positive");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("donation_tiers")
    .select("label,description,amount,compare_at_amount,is_active")
    .eq("id", tierId)
    .single();
  const next = {
    amount,
    compare_at_amount: compareAtAmount,
    description,
    is_active: isActive,
    label,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("donation_tiers").update(next).eq("id", tierId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-settings",
      formData,
      key: "donation-tier-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_donation_tier",
    adminUserId: admin.id,
    after: next,
    before: before ?? null,
    reason: `Updated development support tier ${tierId}`,
    targetId: tierId,
    targetType: "donation_tier",
  });

  revalidatePath(`/${locale}/contributions`);
  revalidatePath(`/${locale}/admin/support-settings`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-settings",
    formData,
    key: "donation-tier-updated",
    locale,
    tone: "notice",
  });
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
    redirectWithAdminFeedback({
      fallbackPath: `/admin/support-feedback/${feedbackId}`,
      formData,
      key: "feedback-reply-failed",
      locale,
      tone: "error",
    });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("support_feedback")
    .update({ status: "reviewing", updated_at: now })
    .eq("id", feedbackId);

  if (updateError) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/support-feedback/${feedbackId}`,
      formData,
      key: "feedback-reply-failed",
      locale,
      tone: "error",
    });
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
  revalidatePath(`/${locale}/support/feedback/${feedbackId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/support-feedback/${feedbackId}`,
    formData,
    key: "feedback-replied",
    locale,
    tone: "notice",
  });
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
    redirectWithAdminFeedback({
      fallbackPath: "/admin/certificates",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/certificates",
    formData,
    key: "certificate-revoked",
    locale,
    tone: "notice",
  });
}

export async function createSoftwareRelease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const version = getRequiredString(formData, "version", "Version is required");
  const releasedAt = getReleaseDate(formData);
  const notes = getReleaseNotes(formData);
  const deliveryMode = getReleaseDeliveryMode(formData);
  let files: { platform: ReleasePlatform; file: File }[] = [];
  let macosPrimaryUrl: string | null = null;
  let macosBackupUrl: string | null = null;
  let windowsPrimaryUrl: string | null = null;
  let windowsBackupUrl: string | null = null;

  if (deliveryMode === "file") {
    files = [
      { platform: "macos", file: getUploadFile(formData, "macos_file") as File },
      { platform: "windows", file: getUploadFile(formData, "windows_file") as File },
    ].filter((entry): entry is { platform: ReleasePlatform; file: File } => Boolean(entry.file));

    if (files.length !== 2) {
      throw new Error("Upload both macOS and Windows installer files");
    }
  } else {
    macosPrimaryUrl = getRequiredReleaseUrl(formData, "macos_primary_url");
    macosBackupUrl = getOptionalReleaseUrl(formData, "macos_backup_url");
    windowsPrimaryUrl = getRequiredReleaseUrl(formData, "windows_primary_url");
    windowsBackupUrl = getOptionalReleaseUrl(formData, "windows_backup_url");

    if (macosBackupUrl && macosBackupUrl === macosPrimaryUrl) {
      throw new Error("Backup URL must be different from the primary URL");
    }

    if (windowsBackupUrl && windowsBackupUrl === windowsPrimaryUrl) {
      throw new Error("Backup URL must be different from the primary URL");
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data: release, error: releaseError } = await supabase
    .from("software_releases")
    .insert({
      created_by: admin.id,
      delivery_mode: deliveryMode,
      is_published: formData.get("is_published") === "on",
      macos_backup_url: macosBackupUrl,
      macos_primary_url: macosPrimaryUrl,
      notes,
      released_at: releasedAt,
      version,
      windows_backup_url: windowsBackupUrl,
      windows_primary_url: windowsPrimaryUrl,
    })
    .select("id")
    .single();

  if (releaseError || !release) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/releases",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  if (deliveryMode === "file") {
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
      redirectWithAdminFeedback({
        fallbackPath: "/admin/releases",
        formData,
        key: "operation-failed",
        locale,
        tone: "error",
      });
    }
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/versions`);
  revalidatePath(`/${locale}/admin/releases`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/releases",
    formData,
    key: "release-created",
    locale,
    tone: "notice",
  });
}

export async function setSoftwareReleasePublished(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const releaseId = getRequiredString(formData, "release_id", "Release is required");
  const isPublished = String(formData.get("is_published") ?? "false") === "true";
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("software_releases").update({ is_published: isPublished }).eq("id", releaseId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/releases",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/versions`);
  revalidatePath(`/${locale}/admin/releases`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/releases",
    formData,
    key: "release-updated",
    locale,
    tone: "notice",
  });
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
