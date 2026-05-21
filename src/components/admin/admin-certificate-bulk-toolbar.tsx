"use client";

import { useEffect, useState } from "react";

function getSelectedCertificateInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="certificate_ids"]:checked, input[form="${formId}"][name="certificate_ids"]:checked`,
    ),
  );
}

function getAllCertificateInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="certificate_ids"], input[form="${formId}"][name="certificate_ids"]`,
    ),
  );
}

export function useSelectedCertificates(formId: string) {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const update = () => {
      setSelectedCount(getSelectedCertificateInputs(formId).length);
    };

    update();
    document.addEventListener("change", update);

    return () => document.removeEventListener("change", update);
  }, [formId]);

  return selectedCount;
}

export function AdminCertificateSelectAllCheckbox({ formId, label }: { formId: string; label: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const update = () => {
      const selected = getSelectedCertificateInputs(formId).length;
      const total = getAllCertificateInputs(formId).length;
      setChecked(total > 0 && selected === total);
    };

    update();
    document.addEventListener("change", update);

    return () => document.removeEventListener("change", update);
  }, [formId]);

  return (
    <input
      aria-label={label}
      checked={checked}
      className="size-4 rounded border-slate-300"
      onChange={(event) => {
        getAllCertificateInputs(formId).forEach((row) => {
          row.checked = event.target.checked;
        });
        setChecked(event.target.checked);
      }}
      type="checkbox"
    />
  );
}

type AdminCertificateBulkToolbarProps = {
  formId: string;
  labels: {
    selectedCount: string;
    exportSelected: string;
    clearSelection: string;
  };
  onExportSelected: () => void;
};

export function AdminCertificateBulkToolbar({
  formId,
  labels,
  onExportSelected,
}: AdminCertificateBulkToolbarProps) {
  const selectedCount = useSelectedCertificates(formId);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-medium text-slate-900">
        {labels.selectedCount.replace("{count}", String(selectedCount))}
      </p>
      <div className="flex gap-2">
        <button
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50"
          onClick={() => {
            getSelectedCertificateInputs(formId).forEach((input) => {
              input.checked = false;
            });
          }}
          type="button"
        >
          {labels.clearSelection}
        </button>
        <button
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          onClick={onExportSelected}
          type="button"
        >
          {labels.exportSelected}
        </button>
      </div>
    </div>
  );
}
