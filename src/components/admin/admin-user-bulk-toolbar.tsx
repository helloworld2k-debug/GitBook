"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ROW_ACTION_MENU_GAP = 8;
const ROW_ACTION_MENU_MARGIN = 12;
const ROW_ACTION_MENU_MIN_HEIGHT = 180;
const ROW_ACTION_MENU_WIDTH = 224;

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

function syncBulkAccountTypeToForm(form: HTMLFormElement, formId: string) {
  const typeSelect = document.getElementById(`${formId}-account-type`);

  if (typeSelect instanceof HTMLSelectElement) {
    setHiddenFormValue(form, "account_type", typeSelect.value);
  }
}

function submitBulkIntent(formId: string, intent: string, confirmMessage?: string) {
  const form = document.getElementById(formId);

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  // Show confirmation if message provided
  if (confirmMessage && !confirm(confirmMessage)) {
    return;
  }

  setHiddenFormValue(form, "intent", intent);
  syncSelectedUsersToForm(form, formId);
  syncBulkRoleToForm(form, formId);
  syncBulkAccountTypeToForm(form, formId);
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
    aiTestType: string;
    bulkArchiveDelete: string;
    bulkArchiveDeleteSelected: string;
    bulkDisable: string;
    bulkEnable: string;
    bulkRole: string;
    bulkSoftDelete: string;
    bulkSoftDeleteSelected: string;
    bulkType: string;
    clearSelection: string;
    dangerZone: string;
    operatorRole: string;
    ownerRole: string;
    roleTarget: string;
    selectedCount: string;
    standardType: string;
    typeTarget: string;
    userRole: string;
    bulkEnableConfirm?: string;
    bulkDisableConfirm?: string;
    bulkRoleConfirm?: string;
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
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15 active:bg-white/20" onClick={() => submitBulkIntent(formId, "enable", labels.bulkEnableConfirm)} type="button">
          {labels.bulkEnable}
        </button>
        <button className="inline-flex min-h-10 items-center rounded-md bg-white/10 px-3 text-sm font-medium transition-colors hover:bg-white/15 active:bg-white/20" onClick={() => submitBulkIntent(formId, "disable", labels.bulkDisableConfirm)} type="button">
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
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-white/10 px-2 py-2">
          <label className="text-xs font-medium text-white/80" htmlFor={`${formId}-account-type`}>
            {labels.typeTarget}
          </label>
          <select className="min-h-9 rounded-md border border-white/20 bg-slate-900 px-2 text-sm text-white" form={formId} id={`${formId}-account-type`} name="account_type">
            <option value="standard">{labels.standardType}</option>
            <option value="ai_test">{labels.aiTestType}</option>
          </select>
          <button className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm font-medium transition-colors hover:bg-white/10 active:bg-white/15" onClick={() => submitBulkIntent(formId, "change-account-type")} type="button">
            {labels.bulkType}
          </button>
        </div>
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
            <button
              aria-label={labels.bulkArchiveDeleteSelected}
              className="inline-flex min-h-10 items-center rounded-md bg-orange-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500 active:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => submitBulkIntent(formId, "archive-delete")}
              type="button"
            >
              {labels.bulkArchiveDelete}
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

export function AdminUserRowActionsMenu({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; maxHeight: number; top: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) {
      return;
    }

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const menuWidth = Math.min(ROW_ACTION_MENU_WIDTH, Math.max(160, viewportWidth - ROW_ACTION_MENU_MARGIN * 2));
    const maxLeft = Math.max(ROW_ACTION_MENU_MARGIN, viewportWidth - menuWidth - ROW_ACTION_MENU_MARGIN);
    const left = Math.min(Math.max(ROW_ACTION_MENU_MARGIN, buttonRect.right - menuWidth), maxLeft);
    const availableBelow = viewportHeight - buttonRect.bottom - ROW_ACTION_MENU_GAP - ROW_ACTION_MENU_MARGIN;
    const availableAbove = buttonRect.top - ROW_ACTION_MENU_GAP - ROW_ACTION_MENU_MARGIN;
    const shouldOpenAbove = availableBelow < ROW_ACTION_MENU_MIN_HEIGHT && availableAbove > availableBelow;
    const maxHeight = Math.max(140, shouldOpenAbove ? availableAbove : availableBelow);
    const top = shouldOpenAbove
      ? Math.max(ROW_ACTION_MENU_MARGIN, buttonRect.top - ROW_ACTION_MENU_GAP - maxHeight)
      : Math.min(buttonRect.bottom + ROW_ACTION_MENU_GAP, viewportHeight - ROW_ACTION_MENU_MARGIN - maxHeight);

    setPosition({
      left,
      maxHeight,
      top,
      width: menuWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative" ref={triggerRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            updatePosition();
            setOpen(true);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        {label}
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed z-[100] grid gap-3 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 text-left shadow-xl"
          id={menuId}
          ref={menuRef}
          role="menu"
          style={{ left: position.left, maxHeight: position.maxHeight, top: position.top, width: position.width }}
        >
          {children}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
