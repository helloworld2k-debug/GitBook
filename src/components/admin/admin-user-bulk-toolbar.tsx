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
        const rows = document.querySelectorAll<HTMLInputElement>(`form#${formId} input[name="user_ids"]`);
        rows.forEach((row) => {
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
    clearSelection: string;
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
        <p className="text-sm font-semibold">{labels.selectedCount.replace("{count}", String(count))}</p>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium" form={formId} name="intent" type="submit" value="enable">
          {labels.bulkEnable}
        </button>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium" form={formId} name="intent" type="submit" value="disable">
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
            <button className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm font-medium" form={formId} name="intent" type="submit" value="change-role">
              {labels.bulkRole}
            </button>
          </div>
        ) : null}
        <button className="inline-flex min-h-10 items-center rounded-md bg-red-500 px-3 text-sm font-semibold text-white" form={formId} name="intent" type="submit" value="soft-delete">
          {labels.bulkSoftDelete}
        </button>
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
