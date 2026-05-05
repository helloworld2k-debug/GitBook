"use client";

import { useState } from "react";

type AdminReleaseDeliveryModeFieldsProps = {
  labels: {
    deliveryMode: string;
    deliveryModeFile: string;
    deliveryModeFileHelp: string;
    deliveryModeLink: string;
    deliveryModeLinkHelp: string;
    macBackupUrl: string;
    macFile: string;
    macPrimaryUrl: string;
    windowsBackupUrl: string;
    windowsFile: string;
    windowsPrimaryUrl: string;
  };
};

export function AdminReleaseDeliveryModeFields({ labels }: AdminReleaseDeliveryModeFieldsProps) {
  const [deliveryMode, setDeliveryMode] = useState<"file" | "link">("file");

  return (
    <>
      <fieldset className="grid gap-3">
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
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-950">
            {labels.macFile}
            <input aria-label={labels.macFile} className="mt-2 block w-full text-sm text-slate-700" name="macos_file" type="file" />
          </label>
          <label className="text-sm font-medium text-slate-950">
            {labels.windowsFile}
            <input aria-label={labels.windowsFile} className="mt-2 block w-full text-sm text-slate-700" name="windows_file" type="file" />
          </label>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-950">
              {labels.macPrimaryUrl}
              <input aria-label={labels.macPrimaryUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_primary_url" placeholder="https://downloads.example/mac.dmg" />
            </label>
            <label className="text-sm font-medium text-slate-950">
              {labels.macBackupUrl}
              <input aria-label={labels.macBackupUrl} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="macos_backup_url" placeholder="https://mirror.example/mac.dmg" />
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
        </>
      )}
    </>
  );
}
