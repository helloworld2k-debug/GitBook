"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "tus-js-client";
import { finalizeMissingReleaseAssetUpload, prepareMissingReleaseAssetUpload } from "@/app/[locale]/admin/actions/releases";
import { MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES } from "@/app/[locale]/admin/actions/validation";
import type { ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PreparedAsset = {
  contentType: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
};

type PreparedMissingAssetUpload = {
  asset: PreparedAsset;
  bucket: string;
  platform: ReleasePlatform;
  releaseId: string;
  storageEndpoint: string;
};

type MissingAssetUploadProps = {
  labels: {
    addInstaller: string;
    comingSoon: string;
    uploadComplete: string;
    uploadFailed: string;
    uploadLimitError: string;
    uploadUploading: string;
  };
  locale: string;
  platform: ReleasePlatform;
  releaseId: string;
};

export function AdminReleaseMissingAssetUpload({ labels, locale, platform, releaseId }: MissingAssetUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const uploadRef = useRef<Upload | null>(null);

  function onFileChange(nextFile: File | null) {
    uploadRef.current?.abort();
    setError(null);
    setProgress(0);
    setStatus("idle");

    if (!nextFile) {
      setFile(null);
      return;
    }

    setFile(nextFile);
    if (nextFile.size > MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES) {
      setError(labels.uploadLimitError);
      setStatus("error");
    }
  }

  function appendMetadata(formData: FormData, prepared: PreparedMissingAssetUpload) {
    if (!file) return;

    formData.set("locale", locale);
    formData.set("release_id", releaseId);
    formData.set("platform", platform);
    formData.set(`${platform}_file_name`, file.name);
    formData.set(`${platform}_file_size`, String(file.size));
    formData.set(`${platform}_file_type`, file.type || "application/octet-stream");
    formData.set(`${platform}_storage_path`, prepared.asset.storagePath);
  }

  function startUpload(prepared: PreparedMissingAssetUpload, accessToken?: string) {
    if (!file) return;

    const upload = new Upload(file, {
      endpoint: prepared.storageEndpoint,
      fingerprint: async (fingerprintFile) => [
        prepared.bucket,
        prepared.releaseId,
        platform,
        prepared.asset.storagePath,
        fingerprintFile.name,
        fingerprintFile.size,
        fingerprintFile.lastModified,
      ].join(":"),
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        "x-upsert": "false",
      },
      metadata: {
        bucketName: prepared.bucket,
        cacheControl: "3600",
        contentType: prepared.asset.contentType || file.type || "application/octet-stream",
        objectName: prepared.asset.storagePath,
      },
      onError(uploadError) {
        setError(uploadError.message);
        setStatus("error");
      },
      onProgress(bytesUploaded, bytesTotal) {
        setProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
        setStatus("uploading");
      },
      onSuccess() {
        setProgress(100);
        setStatus("complete");
        const formData = new FormData();
        appendMetadata(formData, prepared);
        startTransition(async () => {
          try {
            await finalizeMissingReleaseAssetUpload(formData);
          } catch (finalizeError) {
            if (finalizeError instanceof Error && !finalizeError.message.startsWith("NEXT_REDIRECT") && !finalizeError.message.startsWith("redirect:")) {
              setError(finalizeError.message);
              setStatus("error");
            }
          }
        });
      },
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
    });

    uploadRef.current = upload;
    setStatus("uploading");
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(() => upload.start());
  }

  function prepareAndUpload() {
    if (!file || status === "error") return;

    setError(null);
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("release_id", releaseId);
    formData.set("platform", platform);
    formData.set(`${platform}_file_name`, file.name);
    formData.set(`${platform}_file_size`, String(file.size));
    formData.set(`${platform}_file_type`, file.type || "application/octet-stream");

    startTransition(async () => {
      try {
        const prepared = await prepareMissingReleaseAssetUpload(formData);
        const { data } = await createSupabaseBrowserClient().auth.getSession();
        startUpload(prepared, data.session?.access_token);
      } catch (prepareError) {
        setError(prepareError instanceof Error ? prepareError.message : labels.uploadFailed);
        setStatus("error");
      }
    });
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-sm text-slate-500">{labels.comingSoon}</p>
      <input
        aria-label={labels.addInstaller}
        className="block w-full text-sm text-slate-700"
        onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)}
        type="file"
      />
      {file ? <p className="break-all text-sm text-slate-600">{file.name}</p> : null}
      {progress > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-slate-950 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {status === "complete" ? <p className="text-sm font-medium text-emerald-700">{labels.uploadComplete}</p> : null}
      <button
        className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!file || status === "error" || status === "uploading" || isPending}
        onClick={prepareAndUpload}
        type="button"
      >
        {status === "uploading" || isPending ? labels.uploadUploading : labels.addInstaller}
      </button>
    </div>
  );
}
