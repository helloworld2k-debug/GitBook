"use client";

import { useEffect, useState } from "react";

function getSelectedInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="license_code_ids"]:checked, input[form="${formId}"][name="license_code_ids"]:checked`,
    ),
  );
}

function getAllInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="license_code_ids"], input[form="${formId}"][name="license_code_ids"]`,
    ),
  );
}

function setHiddenFormValue(form: HTMLFormElement, name: string, value: string) {
  const existing = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);

  if (existing) {
    existing.value = value;
    return;
  }

  const input = document.createElement("input");
  input.name = name;
  input.type = "hidden";
  input.value = value;
  form.append(input);
}

function syncSelectedToForm(form: HTMLFormElement, formId: string) {
  form.querySelectorAll<HTMLInputElement>('input[data-bulk-generated="true"][name="license_code_ids"]').forEach((input) => input.remove());

  getSelectedInputs(formId).filter((selected) => !form.contains(selected)).forEach((selected) => {
    const input = document.createElement("input");
    input.dataset.bulkGenerated = "true";
    input.name = "license_code_ids";
    input.type = "hidden";
    input.value = selected.value;
    form.append(input);
  });
}

function syncMetadataToForm(form: HTMLFormElement, formId: string) {
  const channelType = document.getElementById(`${formId}-channel-type`);

  if (channelType instanceof HTMLSelectElement) {
    setHiddenFormValue(form, "channel_type", channelType.value);
  }
}

function submitBulkAction(formId: string, action: string) {
  const form = document.getElementById(formId);

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  setHiddenFormValue(form, "bulk_action", action);
  syncSelectedToForm(form, formId);
  syncMetadataToForm(form, formId);
  form.requestSubmit();
}

export function AdminLicenseSelectAllCheckbox({ formId, label }: { formId: string; label: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const update = () => {
      const selected = getSelectedInputs(formId).length;
      const total = getAllInputs(formId).length;
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
        getAllInputs(formId).forEach((input) => {
          input.checked = event.currentTarget.checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }}
      type="checkbox"
    />
  );
}

export function AdminLicenseBulkToolbar({
  formId,
  labels,
}: {
  formId: string;
  labels: {
    activate: string;
    applyMetadata: string;
    channel: string;
    clearSelection: string;
    deactivate: string;
    delete: string;
    internal: string;
    other: string;
    partner: string;
    selectedCount: string;
    taobao: string;
    xianyu: string;
  };
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(getSelectedInputs(formId).length);

    update();
    document.addEventListener("change", update);

    return () => document.removeEventListener("change", update);
  }, [formId]);

  if (count === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">{labels.selectedCount.replace("{count}", String(count)).replace("__COUNT__", String(count))}</p>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15" onClick={() => submitBulkAction(formId, "activate")} type="button">
          {labels.activate}
        </button>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15" onClick={() => submitBulkAction(formId, "deactivate")} type="button">
          {labels.deactivate}
        </button>
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-white/10 px-2 py-2">
          <label className="grid gap-1 text-xs font-medium text-white/80" htmlFor={`${formId}-channel-type`}>
            {labels.channel}
            <select className="min-h-9 rounded-md border border-white/20 bg-slate-900 px-2 text-sm text-white" id={`${formId}-channel-type`}>
              <option value="internal">{labels.internal}</option>
              <option value="taobao">{labels.taobao}</option>
              <option value="xianyu">{labels.xianyu}</option>
              <option value="partner">{labels.partner}</option>
              <option value="other">{labels.other}</option>
            </select>
          </label>
          <button className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm font-medium transition-colors hover:bg-white/10" onClick={() => submitBulkAction(formId, "metadata")} type="button">
            {labels.applyMetadata}
          </button>
        </div>
        <button className="inline-flex min-h-10 items-center rounded-md bg-red-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-red-400" onClick={() => submitBulkAction(formId, "delete")} type="button">
          {labels.delete}
        </button>
        <button
          className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white"
          onClick={() => {
            getSelectedInputs(formId).forEach((input) => {
              input.checked = false;
              input.dispatchEvent(new Event("change", { bubbles: true }));
            });
          }}
          type="button"
        >
          {labels.clearSelection}
        </button>
      </div>
    </div>
  );
}
