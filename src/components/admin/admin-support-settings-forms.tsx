"use client";

import { useActionState, useMemo, useState } from "react";
import { updatePaymentCheckoutMaintenanceInline, updateSupportContactChannelInline } from "@/app/[locale]/admin/actions";
import type { SupportChannelId } from "@/config/support";
import type { AdminInlineActionState } from "@/lib/admin/inline-action";
import { defaultPaymentMaintenanceMessage, type PaymentCheckoutStatus } from "@/lib/payments/maintenance";
import { AdminSubmitButton } from "./admin-submit-button";

type SupportContactChannelRow = {
  id: SupportChannelId;
  is_enabled: boolean;
  label: string;
  sort_order: number;
  value: string;
};

type SupportContactChannelInlineData = {
  channel: SupportContactChannelRow;
};

type PaymentMaintenanceInlineData = {
  status: PaymentCheckoutStatus;
};

type SupportChannelSettingsFormProps = {
  channel: SupportContactChannelRow;
  channelHintKey: Record<string, string>;
  channelPlaceholders: Record<string, string>;
  isSaved?: boolean;
  locale: string;
  t: (key: string) => string;
};

type PaymentMaintenanceFormProps = {
  isSaved?: boolean;
  locale: string;
  status: PaymentCheckoutStatus;
  t: (key: string) => string;
};

function InlineFeedback({
  description,
  fallback,
  state,
}: {
  description?: string;
  fallback: string;
  state: AdminInlineActionState;
}) {
  if (!state.tone && !fallback) {
    return null;
  }

  const isError = state.tone === "error";
  const message = state.message ?? fallback;

  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      className={`rounded-md border px-3 py-2 text-xs leading-5 ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role={isError ? "alert" : "status"}
    >
      <p className="font-semibold">{message}</p>
      {!isError && description ? <p className="mt-1">{description}</p> : null}
    </div>
  );
}

export function SupportChannelSettingsForm({
  channel,
  channelHintKey,
  channelPlaceholders,
  isSaved = false,
  locale,
  t,
}: SupportChannelSettingsFormProps) {
  const [state, formAction] = useActionState<AdminInlineActionState<SupportContactChannelInlineData>, FormData>(
    updateSupportContactChannelInline,
    isSaved ? { key: "support-contact-updated", tone: "notice" } : {},
  );
  const localChannel = state.data?.channel ?? channel;
  const [selectedEnabled, setSelectedEnabled] = useState(channel.is_enabled);
  const resolvedSelectedEnabled = state.data?.channel ? state.data.channel.is_enabled : selectedEnabled;
  const showSaved = state.tone === "notice" || isSaved;

  return (
    <form
      action={formAction}
      aria-label={localChannel.label}
      className={`grid grid-cols-1 gap-4 px-4 py-5 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.85fr)_minmax(14rem,1.55fr)_minmax(12rem,240px)_minmax(8rem,120px)_minmax(9rem,160px)] xl:items-start ${
        showSaved ? "bg-emerald-50/60" : ""
      }`}
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/support-settings" />
      <input name="channel_id" type="hidden" value={localChannel.id} />
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.channel")}
        <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm" defaultValue={localChannel.label} name="label" />
        {localChannel.id === "email" ? <span className="text-xs leading-5 text-slate-500">{t("supportSettings.emailHelp")}</span> : null}
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.value")}
        <input
          className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={localChannel.value}
          name="value"
          placeholder={channelPlaceholders[localChannel.id] ?? ""}
        />
        <span className="text-xs leading-5 text-slate-500">{t(channelHintKey[localChannel.id] ?? "supportSettings.previewDescription")}</span>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.status")}
        <span className="inline-flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
          <span className="min-w-0 truncate text-sm text-slate-700">{resolvedSelectedEnabled ? t("supportSettings.enabled") : t("supportSettings.disabled")}</span>
          <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${resolvedSelectedEnabled ? "bg-slate-950" : "bg-slate-300"}`}>
            <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${resolvedSelectedEnabled ? "translate-x-5" : "translate-x-0"}`} />
            <input
              checked={resolvedSelectedEnabled}
              className="absolute inset-0 cursor-pointer opacity-0"
              name="is_enabled"
              onChange={(event) => setSelectedEnabled(event.target.checked)}
              type="checkbox"
            />
          </span>
        </span>
        <span className="text-xs leading-5 text-slate-500">{t("supportSettings.statusHelp")}</span>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.sortOrder")}
        <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm" defaultValue={localChannel.sort_order} min="1" name="sort_order" type="number" />
        <span className="text-xs leading-5 text-slate-500">{t("supportSettings.sortOrderHelp")}</span>
      </label>
      <div className="flex items-start md:col-span-2 xl:col-span-1 xl:pt-7">
        <div className="flex w-full flex-col gap-2">
          <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
            {t("supportSettings.save")}
          </AdminSubmitButton>
          {state.tone ? (
            <InlineFeedback
              description={state.tone === "notice" ? t("supportSettings.rowSavedDescription") : undefined}
              fallback={state.tone === "notice" ? t("supportSettings.rowSaved") : t("supportSettings.supportContactUpdateFailed")}
              state={state}
            />
          ) : null}
        </div>
      </div>
    </form>
  );
}

export function PaymentMaintenanceForm({ isSaved = false, locale, status, t }: PaymentMaintenanceFormProps) {
  const [state, formAction] = useActionState<AdminInlineActionState<PaymentMaintenanceInlineData>, FormData>(
    updatePaymentCheckoutMaintenanceInline,
    isSaved ? { key: "payment-maintenance-updated", tone: "notice" } : {},
  );
  const localStatus = state.data?.status ?? status;
  const [selectedPaused, setSelectedPaused] = useState(status.isPaused);
  const resolvedSelectedPaused = state.data?.status ? state.data.status.isPaused : selectedPaused;
  const message = useMemo(() => localStatus.message ?? defaultPaymentMaintenanceMessage, [localStatus.message]);

  return (
    <form
      action={formAction}
      aria-label="Payment maintenance"
      className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,220px)_minmax(18rem,1fr)_minmax(9rem,180px)] lg:items-start"
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/support-settings" />
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.paymentMaintenanceStatus")}
        <span className="inline-flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
          <span className="min-w-0 truncate text-sm text-slate-700">
            {resolvedSelectedPaused ? t("supportSettings.paymentMaintenancePaused") : t("supportSettings.paymentMaintenanceAvailable")}
          </span>
          <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${resolvedSelectedPaused ? "bg-amber-500" : "bg-slate-950"}`}>
            <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${resolvedSelectedPaused ? "translate-x-5" : "translate-x-0"}`} />
            <input
              aria-label={t("supportSettings.paymentMaintenanceStatus")}
              checked={resolvedSelectedPaused}
              className="absolute inset-0 cursor-pointer opacity-0"
              name="is_paused"
              onChange={(event) => setSelectedPaused(event.target.checked)}
              type="checkbox"
            />
          </span>
        </span>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.paymentMaintenanceMessage")}
        <textarea className="min-h-24 min-w-0 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" defaultValue={message} maxLength={280} name="message" required />
        <span className="text-xs leading-5 text-slate-500">{t("supportSettings.paymentMaintenanceMessageHelp")}</span>
      </label>
      <div className="flex min-w-0 items-start lg:pt-7">
        <div className="flex w-full flex-col gap-2">
          <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
            {t("supportSettings.paymentMaintenanceSave")}
          </AdminSubmitButton>
          {state.tone ? (
            <InlineFeedback
              fallback={state.tone === "notice" ? t("supportSettings.rowSaved") : t("supportSettings.paymentMaintenanceUpdateFailed")}
              state={state}
            />
          ) : null}
        </div>
      </div>
    </form>
  );
}
