"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X } from "lucide-react";
import {
  deleteTrialCode,
  setTrialCodeActive,
  updateTrialCode,
} from "@/app/[locale]/admin/actions";
import { TrialCodeRevealButton } from "./trial-code-reveal-button";
import { AdminSubmitButton } from "./admin-submit-button";

type LicenseActionCode = {
  batchId: string | null;
  channelType: "internal" | "taobao" | "xianyu" | "partner" | "other";
  codeMask: string | null;
  deletedAt: string | null;
  durationKind: "trial_3_day" | "month_1" | "month_3" | "year_1";
  durationLabel: string;
  id: string;
  isActive: boolean;
  label: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  trialDays: number;
};

type ChannelLabels = Record<LicenseActionCode["channelType"], string>;

type Labels = {
  action: string;
  activate: string;
  active: string;
  channel: string;
  close: string;
  code: string;
  confirmDeleteHelp: string;
  copied: string;
  copy: string;
  deactivate: string;
  deleteCode: string;
  deleteCodeConfirm: string;
  duration: string;
  editCode: string;
  hide: string;
  inactive: string;
  redemptions: string;
  reveal: string;
  revealError: string;
  save: string;
  trialDays: string;
};

export function AdminLicenseActionsMenu({
  channels,
  code,
  labels,
  locale,
}: {
  channels: ChannelLabels;
  code: LicenseActionCode;
  labels: Labels;
  locale: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <div className="relative flex justify-end" ref={menuRef}>
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        onClick={() => {
          setMenuOpen((open) => !open);
          setConfirmDelete(false);
        }}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
        {labels.action}
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-12 z-50 w-56 rounded-md border border-slate-200 bg-white p-2 text-left shadow-xl"
          id={menuId}
          role="menu"
        >
          <div className="px-2 py-2">
            <TrialCodeRevealButton
              copiedLabel={labels.copied}
              copyLabel={labels.copy}
              errorLabel={labels.revealError}
              hideLabel={labels.hide}
              locale={locale}
              revealLabel={labels.reveal}
              trialCodeId={code.id}
            />
          </div>
          <button
            className="flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setDrawerOpen(true);
              setMenuOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            {labels.editCode}
          </button>
          {code.deletedAt ? null : (
            <form action={setTrialCodeActive}>
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value="/admin/licenses" />
              <input name="trial_code_id" type="hidden" value={code.id} />
              <input name="is_active" type="hidden" value={code.isActive ? "false" : "true"} />
              <AdminSubmitButton className="flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" pendingLabel={labels.save}>
                {code.isActive ? labels.deactivate : labels.activate}
              </AdminSubmitButton>
            </form>
          )}
          {code.deletedAt ? null : (
            <form action={deleteTrialCode} data-testid="license-code-delete-form" className="mt-2 border-t border-slate-200 pt-2">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value="/admin/licenses" />
              <input name="trial_code_id" type="hidden" value={code.id} />
              <button
                className="flex min-h-10 w-full items-center rounded-md px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                onClick={(event) => {
                  if (!confirmDelete) {
                    event.preventDefault();
                    setConfirmDelete(true);
                  }
                }}
                role="menuitem"
                type="submit"
              >
                {confirmDelete ? labels.deleteCodeConfirm : labels.deleteCode}
              </button>
              {confirmDelete ? <p className="px-3 pb-2 text-xs text-amber-700">{labels.confirmDeleteHelp}</p> : null}
            </form>
          )}
        </div>
      ) : null}

      <AdminLicenseEditDrawer
        channels={channels}
        code={code}
        labels={labels}
        locale={locale}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      />
    </div>
  );
}

function AdminLicenseEditDrawer({
  channels,
  code,
  labels,
  locale,
  onClose,
  open,
}: {
  channels: ChannelLabels;
  code: LicenseActionCode;
  labels: Labels;
  locale: string;
  onClose: () => void;
  open: boolean;
}) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/30" role="presentation">
      <div
        aria-label={labels.editCode}
        aria-modal="true"
        className="fixed inset-y-0 right-0 grid w-[min(100vw,28rem)] grid-rows-[auto_1fr] overflow-y-auto bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{labels.editCode}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{code.id}</p>
          </div>
          <button
            aria-label={labels.close}
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-4">
          <dl className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">{labels.code}</dt>
              <dd className="mt-1 font-mono text-slate-950">{code.codeMask ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">{labels.duration}</dt>
              <dd className="mt-1 text-slate-950">{code.durationLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">{labels.redemptions}</dt>
              <dd className="mt-1 text-slate-950">{code.redemptionCount} / {code.maxRedemptions ?? "-"}</dd>
            </div>
          </dl>
          <form action={updateTrialCode} className="grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="return_to" type="hidden" value="/admin/licenses" />
            <input name="trial_code_id" type="hidden" value={code.id} />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {labels.editCode}
              <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-950" defaultValue={code.label} maxLength={120} name="label" required />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {labels.channel}
              <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-950" defaultValue={code.channelType} name="channel_type">
                {(Object.entries(channels) as [LicenseActionCode["channelType"], string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {labels.trialDays}
              <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-950 disabled:bg-slate-100 disabled:text-slate-500" defaultValue={code.trialDays} disabled={code.durationKind !== "trial_3_day"} max="7" min="1" name="trial_days" required={code.durationKind === "trial_3_day"} type="number" />
            </label>
            {code.durationKind !== "trial_3_day" ? <input name="trial_days" type="hidden" value={code.trialDays} /> : null}
            <AdminSubmitButton className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" pendingLabel={labels.save}>
              {labels.save}
            </AdminSubmitButton>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
