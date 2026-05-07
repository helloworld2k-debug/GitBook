"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOptionalReleaseUrl, getReleaseDate, getReleaseDeliveryMode, getReleaseNotes, getRequiredReleaseUrl, getRequiredString, getSafeLocale, getUploadFile, sanitizeFileName } from "./validation";

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
