"use client";

import { useEffect, useState } from "react";

function getSelectedUserInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="user_ids"]:checked, input[form="${formId}"][name="user_ids"]:checked`,
    ),
  );
}

function getAllUserInputs(formId: string) {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="user_ids"], input[form="${formId}"][name="user_ids"]`,
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

function syncSelectedUsersToForm(form: HTMLFormElement, formId: string) {
  form.querySelectorAll<HTMLInputElement>('input[data-bulk-generated="true"][name="user_ids"]').forEach((input) => input.remove());

  getSelectedUserInputs(formId).filter((selected) => !form.contains(selected)).forEach((selected) => {
    const input = document.createElement("input");
    input.dataset.bulkGenerated = "true";
    input.name = "user_ids";
    input.type = "hidden";
    input.value = selected.value;
    form.append(input);
  });
}

function syncBulkRoleToForm(form: HTMLFormElement, formId: string) {
  const roleSelect = document.getElementById(`${formId}-admin-role`);

  if (roleSelect instanceof HTMLSelectElement) {
    setHiddenFormValue(form, "admin_role", roleSelect.value);
  }
}

function submitBulkIntent(formId: string, intent: string) {
  const form = document.getElementById(formId);

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  setHiddenFormValue(form, "intent", intent);
  syncSelectedUsersToForm(form, formId);
  syncBulkRoleToForm(form, formId);
  form.requestSubmit();
}

export function AdminUserSelectAllCheckbox({ formId, label }: { formId: string; label: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const update = () => {
      const selected = getSelectedUserInputs(formId).length;
      const total = getAllUserInputs(formId).length;
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
        getAllUserInputs(formId).forEach((row) => {
          row.checked = event.currentTarget.checked;
          row.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }}
      type="checkbox"
    />
  );
}

export function AdminUserBulkToolbar({
  canManageRoles,
  formId,
  labels,
}: {
  canManageRoles: boolean;
  formId: string;
  labels: {
    bulkDisable: string;
    bulkEnable: string;
    bulkRole: string;
    bulkSoftDelete: string;
    bulkSoftDeleteSelected: string;
    clearSelection: string;
    dangerZone: string;
    operatorRole: string;
    ownerRole: string;
    roleTarget: string;
    selectedCount: string;
    userRole: string;
  };
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      setCount(getSelectedUserInputs(formId).length);
    };

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
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15 active:bg-white/20" onClick={() => submitBulkIntent(formId, "enable")} type="button">
          {labels.bulkEnable}
        </button>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15 active:bg-white/20" onClick={() => submitBulkIntent(formId, "disable")} type="button">
          {labels.bulkDisable}
        </button>
        {canManageRoles ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-white/10 px-2 py-2">
            <label className="text-xs font-medium text-white/80" htmlFor={`${formId}-admin-role`}>
              {labels.roleTarget}
            </label>
            <select className="min-h-9 rounded-md border border-white/20 bg-slate-900 px-2 text-sm text-white" form={formId} id={`${formId}-admin-role`} name="admin_role">
              <option value="user">{labels.userRole}</option>
              <option value="operator">{labels.operatorRole}</option>
              <option value="owner">{labels.ownerRole}</option>
            </select>
            <button className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm font-medium transition-colors hover:bg-white/10 active:bg-white/15" onClick={() => submitBulkIntent(formId, "change-role")} type="button">
              {labels.bulkRole}
            </button>
          </div>
        ) : null}
        <details
          aria-label={labels.dangerZone}
          className="rounded-md border border-red-300/30 bg-red-500/10 px-2 py-2"
          role="group"
        >
          <summary className="min-h-9 cursor-pointer list-none rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&::-webkit-details-marker]:hidden">
            {labels.dangerZone}
          </summary>
          <div className="mt-2 grid gap-2">
            <button
              aria-label={labels.bulkSoftDeleteSelected}
              className="inline-flex min-h-10 items-center rounded-md bg-red-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-red-400 active:bg-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => submitBulkIntent(formId, "soft-delete")}
              type="button"
            >
              {labels.bulkSoftDelete}
            </button>
          </div>
        </details>
        <button
          className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white"
          onClick={() => {
            getSelectedUserInputs(formId).forEach((input) => {
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
