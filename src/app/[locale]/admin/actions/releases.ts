"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { RELEASE_PLATFORMS, SOFTWARE_RELEASES_BUCKET, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOptionalReleaseUrl, getReleaseDate, getReleaseDeliveryMode, getReleaseFileMetadata, getReleaseNotes, getReleaseStoragePath, getRequiredReleaseUrl, getRequiredString, getSafeLocale, getUploadFile, MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES, sanitizeFileName } from "./validation";

type PreparedUploadAsset = {
  contentType: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
};

function getStorageEndpoint() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return "/storage/v1/upload/resumable";
  }

  const url = new URL(supabaseUrl);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.includes(".storage.supabase.co")) {
    url.hostname = url.hostname.replace(".supabase.co", ".storage.supabase.co");
  }

  return `${url.origin}/storage/v1/upload/resumable`;
}

function getStorageObjectName(storagePath: string) {
  return storagePath.split("/").pop() ?? storagePath;
}

async function verifyUploadedObject(
  storage: ReturnType<typeof createSupabaseAdminClient>["storage"],
  storagePath: string,
) {
  const prefix = storagePath.split("/").slice(0, -1).join("/");
  const objectName = getStorageObjectName(storagePath);
  const { data, error } = await storage.from(SOFTWARE_RELEASES_BUCKET).list(prefix, { search: objectName, limit: 1 });

  if (error) {
    throw new Error("Unable to verify uploaded installer");
  }

  const object = data?.find((entry) => entry.name === objectName);
  const size = Number(object?.metadata?.size ?? object?.metadata?.contentLength ?? object?.metadata?.ContentLength ?? 0);

  if (!object) {
    throw new Error("Uploaded installer is missing");
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES) {
    throw new Error("Uploaded installer files must be 50 MB or smaller");
  }

  return size;
}

export async function createSoftwareRelease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const version = getRequiredString(formData, "version", "Version is required");
  const releasedAt = getReleaseDate(formData);
  const notes = getReleaseNotes(formData);
  const deliveryMode = getReleaseDeliveryMode(formData);
  let files: { platform: ReleasePlatform; file: File }[] = [];
  let macosArm64PrimaryUrl: string | null = null;
  let macosArm64BackupUrl: string | null = null;
  let macosX64PrimaryUrl: string | null = null;
  let macosX64BackupUrl: string | null = null;
  let windowsPrimaryUrl: string | null = null;
  let windowsBackupUrl: string | null = null;

  if (deliveryMode === "file") {
    files = RELEASE_PLATFORMS.map((platform) => ({
      platform,
      file: getUploadFile(formData, `${platform}_file`) as File,
    })).filter((entry): entry is { platform: ReleasePlatform; file: File } => Boolean(entry.file));

    if (files.length !== RELEASE_PLATFORMS.length) {
      throw new Error("Upload macOS M chip, macOS Intel, and Windows installer files");
    }
  } else {
    macosArm64PrimaryUrl = getRequiredReleaseUrl(formData, "macos_arm64_primary_url");
    macosArm64BackupUrl = getOptionalReleaseUrl(formData, "macos_arm64_backup_url");
    macosX64PrimaryUrl = getRequiredReleaseUrl(formData, "macos_x64_primary_url");
    macosX64BackupUrl = getOptionalReleaseUrl(formData, "macos_x64_backup_url");
    windowsPrimaryUrl = getRequiredReleaseUrl(formData, "windows_primary_url");
    windowsBackupUrl = getOptionalReleaseUrl(formData, "windows_backup_url");

    if (macosArm64BackupUrl && macosArm64BackupUrl === macosArm64PrimaryUrl) {
      throw new Error("Backup URL must be different from the primary URL");
    }

    if (macosX64BackupUrl && macosX64BackupUrl === macosX64PrimaryUrl) {
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
      macos_arm64_backup_url: macosArm64BackupUrl,
      macos_arm64_primary_url: macosArm64PrimaryUrl,
      macos_backup_url: macosArm64BackupUrl,
      macos_primary_url: macosArm64PrimaryUrl,
      macos_x64_backup_url: macosX64BackupUrl,
      macos_x64_primary_url: macosX64PrimaryUrl,
      notes,
      released_at: releasedAt,
      release_status: "ready",
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

export async function prepareSoftwareReleaseUpload(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const version = getRequiredString(formData, "version", "Version is required");
  const releasedAt = getReleaseDate(formData);
  const notes = getReleaseNotes(formData);
  const fileMetadata = Object.fromEntries(RELEASE_PLATFORMS.map((platform) => [platform, getReleaseFileMetadata(formData, platform)])) as Record<ReleasePlatform, PreparedUploadAsset>;
  const supabase = createSupabaseAdminClient();
  const { data: release, error: releaseError } = await supabase
    .from("software_releases")
    .insert({
      created_by: admin.id,
      delivery_mode: "file",
      is_published: false,
      macos_arm64_backup_url: null,
      macos_arm64_primary_url: null,
      macos_backup_url: null,
      macos_primary_url: null,
      macos_x64_backup_url: null,
      macos_x64_primary_url: null,
      notes,
      released_at: releasedAt,
      release_status: "uploading",
      version,
      windows_backup_url: null,
      windows_primary_url: null,
    })
    .select("id")
    .single();

  if (releaseError || !release) {
    throw new Error("Unable to prepare release upload");
  }

  const assets = Object.fromEntries(
    RELEASE_PLATFORMS.map((platform) => [
      platform,
      {
        ...fileMetadata[platform],
        storagePath: `${release.id}/${platform}/${sanitizeFileName(fileMetadata[platform].fileName)}`,
      },
    ]),
  ) as Record<ReleasePlatform, PreparedUploadAsset>;

  return {
    assets,
    bucket: SOFTWARE_RELEASES_BUCKET,
    releaseId: release.id,
    storageEndpoint: getStorageEndpoint(),
  };
}

export async function finalizeSoftwareReleaseUpload(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const releaseId = getRequiredString(formData, "release_id", "Release is required");
  const isPublished = String(formData.get("is_published") ?? "false") === "true";
  const files = RELEASE_PLATFORMS.map((platform) => ({
    metadata: getReleaseFileMetadata(formData, platform),
    platform,
    storagePath: getReleaseStoragePath(formData, platform),
  }));
  const supabase = createSupabaseAdminClient();
  const { data: release, error: releaseError } = await supabase
    .from("software_releases")
    .select("id,delivery_mode,release_status")
    .eq("id", releaseId)
    .single();

  if (releaseError || !release || release.delivery_mode !== "file") {
    throw new Error("Release upload is invalid");
  }

  const assets = [];
  for (const file of files) {
    const verifiedSize = await verifyUploadedObject(supabase.storage, file.storagePath);

    assets.push({
      file_name: file.metadata.fileName,
      file_size: verifiedSize,
      platform: file.platform,
      release_id: releaseId,
      storage_path: file.storagePath,
    });
  }

  const { error: assetError } = await supabase.from("software_release_assets").insert(assets);

  if (assetError) {
    await supabase.from("software_releases").update({ release_status: "failed" }).eq("id", releaseId);
    throw new Error("Unable to save release assets");
  }

  const { error: updateError } = await supabase
    .from("software_releases")
    .update({ is_published: isPublished, release_status: "ready" })
    .eq("id", releaseId);

  if (updateError) {
    throw new Error("Unable to finalize release upload");
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

export async function deleteDraftSoftwareRelease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const releaseId = getRequiredString(formData, "release_id", "Release is required");
  const supabase = createSupabaseAdminClient();
  const { data: release, error: releaseError } = await supabase
    .from("software_releases")
    .select("id,release_status,software_release_assets(storage_path)")
    .eq("id", releaseId)
    .single();

  if (releaseError || !release) {
    throw new Error("Release is required");
  }

  if (release.release_status === "ready") {
    throw new Error("Published releases cannot be deleted from this action");
  }

  const paths = (release.software_release_assets ?? []).map((asset: { storage_path: string }) => asset.storage_path);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(SOFTWARE_RELEASES_BUCKET).remove(paths);
    if (removeError) {
      throw new Error("Unable to remove uploaded installers");
    }
  }

  const { error: deleteError } = await supabase.from("software_releases").delete().eq("id", releaseId);
  if (deleteError) {
    throw new Error("Unable to delete release");
  }

  revalidatePath(`/${locale}/admin/releases`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/releases",
    formData,
    key: "release-deleted",
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
