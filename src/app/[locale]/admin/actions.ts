"use server";

import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { hashDesktopSecret } from "@/lib/license/hash";
import { SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_REASON_LENGTH = 500;
const MAX_MANUAL_REFERENCE_LENGTH = 120;
const MAX_RELEASE_NOTES_LENGTH = 4000;
const MAX_TRIAL_LABEL_LENGTH = 120;

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

function getDateIso(formData: FormData, key: string, message: string) {
  const rawValue = getRequiredString(formData, key, message);
  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
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
  const code = getRequiredString(formData, "code", "Trial code is required");
  const label = getRequiredString(formData, "label", "Label is required");

  if (label.length > MAX_TRIAL_LABEL_LENGTH) {
    throw new Error("Label must be 120 characters or fewer");
  }

  const trialDays = getPositiveInteger(formData, "trial_days", "Trial days must be a positive integer");
  const maxRedemptions = getOptionalPositiveInteger(
    formData,
    "max_redemptions",
    "Max redemptions must be a positive integer",
  );
  const startsAt = getDateIso(formData, "starts_at", "Start date is required");
  const endsAt = getDateIso(formData, "ends_at", "End date is required");

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("End date must be after start date");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("trial_codes").insert({
    code_hash: await hashDesktopSecret(code, "trial_code"),
    created_by: admin.id,
    ends_at: endsAt,
    feature_code: CLOUD_SYNC_FEATURE,
    is_active: true,
    label,
    max_redemptions: maxRedemptions,
    starts_at: startsAt,
    trial_days: trialDays,
  });

  if (error) {
    throw new Error("Unable to create trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
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

  const trialDays = getPositiveInteger(formData, "trial_days", "Trial days must be a positive integer");
  const maxRedemptions = getOptionalPositiveInteger(
    formData,
    "max_redemptions",
    "Max redemptions must be a positive integer",
  );
  const startsAt = getDateIso(formData, "starts_at", "Start date is required");
  const endsAt = getDateIso(formData, "ends_at", "End date is required");

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("End date must be after start date");
  }

  const { error } = await createSupabaseAdminClient()
    .from("trial_codes")
    .update({
      ends_at: endsAt,
      label,
      max_redemptions: maxRedemptions,
      starts_at: startsAt,
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
  const { error } = await createSupabaseAdminClient()
    .from("desktop_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", desktopSessionId);

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
