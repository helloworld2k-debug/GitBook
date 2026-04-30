"use server";

import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_REASON_LENGTH = 500;
const MAX_MANUAL_REFERENCE_LENGTH = 120;
const MAX_RELEASE_NOTES_LENGTH = 4000;

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
