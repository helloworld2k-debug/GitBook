"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Upload } from "tus-js-client";
import { finalizeSoftwareReleaseUpload, prepareSoftwareReleaseUpload } from "@/app/[locale]/admin/actions/releases";
import { MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES } from "@/app/[locale]/admin/actions/validation";
import { RELEASE_PLATFORMS, type ReleasePlatform } from "@/lib/releases/software-releases";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Platform = ReleasePlatform;
type UploadStatus = "idle" | "uploading" | "paused" | "complete" | "error";

type PreparedAsset = {
  contentType: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
};

type PreparedUpload = {
  assets: Record<Platform, PreparedAsset>;
  bucket: string;
  releaseId: string;
  storageEndpoint: string;
};

type PlatformUploadState = {
  error: string | null;
  file: File | null;
  progress: number;
  status: UploadStatus;
  storagePath: string | null;
  upload: Upload | null;
};

type AdminReleaseDeliveryModeFieldsProps = {
  labels: {
    create?: string;
    createLink?: string;
    deliveryMode: string;
    deliveryModeFile: string;
    deliveryModeFileHelp: string;
    deliveryModeLink: string;
    deliveryModeLinkHelp: string;
    macAppleSiliconBackupUrl: string;
    macAppleSiliconFile: string;
    macAppleSiliconPrimaryUrl: string;
    macIntelBackupUrl: string;
    macIntelFile: string;
    macIntelPrimaryUrl: string;
    maxFileSizeHelp?: string;
    pauseUpload?: string;
    retryUpload?: string;
    resumeUpload?: string;
    uploadComplete?: string;
    uploadFailed?: string;
    uploadIdle?: string;
    uploadLimitError?: string;
    uploadProgress?: string;
    uploadUploading?: string;
    windowsBackupUrl: string;
    windowsFile: string;
    windowsPrimaryUrl: string;
  };
  locale?: string;
};

const emptyUploadState: PlatformUploadState = {
  error: null,
  file: null,
  progress: 0,
  status: "idle",
  storagePath: null,
  upload: null,
};

function formatBytes(value: number) {
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} MB`;
}

export function AdminReleaseDeliveryModeFields({ labels, locale = "en" }: AdminReleaseDeliveryModeFieldsProps) {
  const [deliveryMode, setDeliveryMode] = useState<"file" | "link">("file");
  const [preparedUpload, setPreparedUpload] = useState<PreparedUpload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploads, setUploads] = useState<Record<Platform, PlatformUploadState>>({
    macos_arm64: { ...emptyUploadState },
    macos_x64: { ...emptyUploadState },
    windows: { ...emptyUploadState },
  });
  const uploadsRef = useRef(uploads);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  function getParentForm(): HTMLFormElement | null {
    return fieldsetRef.current?.closest("form") ?? null;
  }

  const limitError = labels.uploadLimitError ?? "Installer files must be 50 MB or smaller. Use download links for larger installers.";
  const allFilesSelected = RELEASE_PLATFORMS.every((platform) => Boolean(uploads[platform].file));
  const hasFileError = RELEASE_PLATFORMS.some((platform) => Boolean(uploads[platform].error));
  const createLabel = labels.create ?? "Create release";
  const createLinkLabel = labels.createLink ?? createLabel;

  const statusLabels = useMemo(() => ({
    complete: labels.uploadComplete ?? "Complete",
    error: labels.uploadFailed ?? "Upload failed",
    idle: labels.uploadIdle ?? "Ready",
    paused: labels.resumeUpload ?? "Resume",
    uploading: labels.uploadUploading ?? "Uploading",
  }), [labels]);

  function setPlatformState(platform: Platform, next: Partial<PlatformUploadState>) {
    setUploads((current) => ({
      ...current,
      [platform]: {
        ...current[platform],
        ...next,
      },
    }));
  }

  function onFileChange(platform: Platform, file: File | null) {
    uploadsRef.current[platform].upload?.abort();

    if (!file) {
      setPlatformState(platform, { ...emptyUploadState });
      return;
    }

    if (file.size > MAX_SOFTWARE_RELEASE_FILE_SIZE_BYTES) {
      setPlatformState(platform, {
        error: limitError,
        file,
        progress: 0,
        status: "error",
        storagePath: null,
        upload: null,
      });
      return;
    }

    setPlatformState(platform, {
      error: null,
      file,
      progress: 0,
      status: "idle",
      storagePath: null,
      upload: null,
    });
  }

  function appendMetadata(formData: FormData, platform: Platform, file: File, storagePath?: string) {
    formData.set(`${platform}_file_name`, file.name);
    formData.set(`${platform}_file_size`, String(file.size));
    formData.set(`${platform}_file_type`, file.type || "application/octet-stream");
    if (storagePath) {
      formData.set(`${platform}_storage_path`, storagePath);
    }
  }

  function buildUpload(platform: Platform, file: File, prepared: PreparedUpload, accessToken?: string) {
    const asset = prepared.assets[platform];
    const upload = new Upload(file, {
      endpoint: prepared.storageEndpoint,
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        "x-upsert": "false",
      },
      metadata: {
        bucketName: prepared.bucket,
        cacheControl: "3600",
        contentType: asset.contentType || file.type || "application/octet-stream",
        objectName: asset.storagePath,
      },
      onError(error) {
        setPlatformState(platform, {
          error: error.message,
          status: "error",
        });
      },
      onProgress(bytesUploaded, bytesTotal) {
        const progress = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
        setPlatformState(platform, { progress, status: "uploading" });
      },
      onSuccess() {
        setPlatformState(platform, {
          error: null,
          progress: 100,
          status: "complete",
          storagePath: asset.storagePath,
        });
        maybeFinalize(prepared);
      },
      removeFingerprintOnSuccess: false,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
    });

    return upload;
  }

  function startUpload(platform: Platform, prepared: PreparedUpload) {
    const file = uploadsRef.current[platform].file;

    if (!file) {
      return;
    }

    createSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token;
      const upload = buildUpload(platform, file, prepared, accessToken);
      setPlatformState(platform, { error: null, status: "uploading", upload });
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(() => {
        upload.start();
      });
    }).catch(() => {
      setPlatformState(platform, { error: "Unable to read admin session", status: "error" });
    });
  }

  function pauseUpload(platform: Platform) {
    uploadsRef.current[platform].upload?.abort();
    setPlatformState(platform, { status: "paused" });
  }

  function resumeUpload(platform: Platform) {
    const prepared = preparedUpload;
    if (!prepared) {
      return;
    }
    startUpload(platform, prepared);
  }

  function retryUpload(platform: Platform) {
    const prepared = preparedUpload;
    if (!prepared) {
      return;
    }
    setPlatformState(platform, { error: null, progress: 0, status: "idle" });
    startUpload(platform, prepared);
  }

  function maybeFinalize(prepared: PreparedUpload) {
    queueMicrotask(() => {
      const current = uploadsRef.current;
      if (!RELEASE_PLATFORMS.every((platform) => current[platform].status === "complete")) {
        return;
      }

      const form = getParentForm();
      const formData = new FormData(form ?? undefined);
      formData.set("locale", locale);
      formData.set("release_id", prepared.releaseId);
      formData.set("is_published", formData.get("is_published") === "on" ? "true" : "false");

      RELEASE_PLATFORMS.forEach((platform) => {
        const file = current[platform].file;
        if (file) {
          appendMetadata(formData, platform, file, prepared.assets[platform].storagePath);
        }
      });

      startTransition(async () => {
        try {
          await finalizeSoftwareReleaseUpload(formData);
        } catch (error) {
          if (error instanceof Error && !error.message.startsWith("NEXT_REDIRECT") && !error.message.startsWith("redirect:")) {
            setFormError(error.message);
          }
        }
      });
    });
  }

  function startPreparedUploads() {
    setFormError(null);
    const form = getParentForm();
    const formData = new FormData(form ?? undefined);
    formData.set("locale", locale);

    RELEASE_PLATFORMS.forEach((platform) => {
      const file = uploadsRef.current[platform].file;
      if (file) {
        appendMetadata(formData, platform, file);
      }
    });

    startTransition(async () => {
      try {
        const prepared = await prepareSoftwareReleaseUpload(formData);
        setPreparedUpload(prepared);
        RELEASE_PLATFORMS.forEach((platform) => startUpload(platform, prepared));
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Unable to prepare release upload");
      }
    });
  }

  function renderUploadRow(platform: Platform, label: string) {
    const state = uploads[platform];
    const percentText = `${state.progress}%`;
    const isComplete = state.status === "complete";
    const isUploading = state.status === "uploading";
    const isPaused = state.status === "paused";
    const isError = state.status === "error";

    return (
      <div className="rounded-md border border-slate-200 p-3">
        <label className="text-sm font-medium text-slate-950">
          {label}
          <input
            aria-label={label}
            className="mt-2 block w-full text-sm text-slate-700"
            name={`${platform}_file`}
            onChange={(event) => onFileChange(platform, event.currentTarget.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {state.file ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="break-all font-medium text-slate-800">{state.file.name}</span>
              <span className="text-slate-500">{formatBytes(state.file.size)}</span>
            </div>
            <div aria-label={`${label} ${labels.uploadProgress ?? "Upload progress"}`} className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress}>
              <div className="h-full rounded-full bg-slate-950 transition-[width] duration-200" style={{ width: `${state.progress}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={isError ? "font-medium text-red-700" : "text-slate-600"}>
                {isError ? state.error : statusLabels[state.status]} {state.status !== "idle" ? percentText : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                {isUploading ? (
                  <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" onClick={() => pauseUpload(platform)} type="button">
                    {labels.pauseUpload ?? "Pause"}
                  </button>
                ) : null}
                {isPaused ? (
                  <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" onClick={() => resumeUpload(platform)} type="button">
                    {labels.resumeUpload ?? "Resume"}
                  </button>
                ) : null}
                {isError && preparedUpload ? (
                  <button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" onClick={() => retryUpload(platform)} type="button">
                    {labels.retryUpload ?? "Retry"}
                  </button>
                ) : null}
                {isComplete ? <span className="inline-flex min-h-10 items-center rounded-md bg-emerald-50 px-3 text-sm font-medium text-emerald-700">{labels.uploadComplete ?? "Complete"}</span> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <fieldset className="grid gap-3" ref={fieldsetRef}>
        <legend className="text-sm font-medium text-slate-950">{labels.deliveryMode}</legend>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 px-4 py-3">
          <input aria-label={labels.deliveryModeFile} checked={deliveryMode === "file"} className="mt-1 size-4" name="delivery_mode" onChange={() => setDeliveryMode("file")} type="radio" value="file" />
          <span>
            <span className="block text-sm font-semibold text-slate-950">{labels.deliveryModeFile}</span>
            <span className="mt-1 block text-sm text-slate-600">{labels.deliveryModeFileHelp}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 px-4 py-3">
          <input aria-label={labels.deliveryModeLink} checked={deliveryMode === "link"} className="mt-1 size-4" name="delivery_mode" onChange={() => setDeliveryMode("link")} type="radio" value="link" />
          <span>
            <span className="block text-sm font-semibold text-slate-950">{labels.deliveryModeLink}</span>
            <span className="mt-1 block text-sm text-slate-600">{labels.deliveryModeLinkHelp}</span>
          </span>
        </label>
      </fieldset>

      {deliveryMode === "file" ? (
        <div className="grid gap-4">
          <p className="text-sm text-slate-600">{labels.maxFileSizeHelp ?? "Max 50 MB per file. Use download links for larger installers."}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {renderUploadRow("macos_arm64", labels.macAppleSiliconFile)}
            {renderUploadRow("macos_x64", labels.macIntelFile)}
            {renderUploadRow("windows", labels.windowsFile)}
          </div>
          {formError ? <p className="text-sm font-medium text-red-700">{formError}</p> : null}
          <button
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!allFilesSelected || hasFileError || isPending}
            onClick={startPreparedUploads}
            type="button"
          >
            {isPending ? labels.uploadUploading ?? "Uploading" : createLabel}
          </button>
          <div hidden>
            {RELEASE_PLATFORMS.flatMap((platform) => {
              const state = uploads[platform];
              if (!state.file) {
                return [];
              }
              const fields = [
                { name: `${platform}_file_name`, value: state.file.name },
                { name: `${platform}_file_size`, value: String(state.file.size) },
                { name: `${platform}_file_type`, value: state.file.type || "application/octet-stream" },
              ];
              if (state.storagePath) {
                fields.push({ name: `${platform}_storage_path`, value: state.storagePath });
              }
              return fields.map((field) => <input key={field.name} name={field.name} type="hidden" value={field.value} />);
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-950">
              {labels.macAppleSiliconPrimaryUrl}
              <input aria-label={labels.macAppleSiliconPrimaryUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_arm64_primary_url" placeholder="https://downloads.example/mac-arm64.dmg" />
            </label>
            <label className="text-sm font-medium text-slate-950">
              {labels.macAppleSiliconBackupUrl}
              <input aria-label={labels.macAppleSiliconBackupUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_arm64_backup_url" placeholder="https://mirror.example/mac-arm64.dmg" />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-950">
              {labels.macIntelPrimaryUrl}
              <input aria-label={labels.macIntelPrimaryUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_x64_primary_url" placeholder="https://downloads.example/mac-intel.dmg" />
            </label>
            <label className="text-sm font-medium text-slate-950">
              {labels.macIntelBackupUrl}
              <input aria-label={labels.macIntelBackupUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_x64_backup_url" placeholder="https://mirror.example/mac-intel.dmg" />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-950">
              {labels.windowsPrimaryUrl}
              <input aria-label={labels.windowsPrimaryUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="windows_primary_url" placeholder="https://downloads.example/win.exe" />
            </label>
            <label className="text-sm font-medium text-slate-950">
              {labels.windowsBackupUrl}
              <input aria-label={labels.windowsBackupUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="windows_backup_url" placeholder="https://mirror.example/win.exe" />
            </label>
          </div>
          <button className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white" type="submit">
            {createLinkLabel}
          </button>
        </>
      )}
    </>
  );
}
