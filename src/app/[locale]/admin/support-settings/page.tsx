import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getDefaultSupportChannelsConfig, normalizeSupportChannels, toSupportChannelRows, type SupportChannelId } from "@/config/support";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { defaultPaymentMaintenanceMessage, getPaymentCheckoutStatus, type PaymentCheckoutStatus, type PaymentCheckoutStatusClient } from "@/lib/payments/maintenance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updatePaymentCheckoutMaintenance, updateSupportContactChannel } from "../actions";

type SupportContactChannelRow = {
  id: SupportChannelId;
  is_enabled: boolean;
  label: string;
  sort_order: number;
  value: string;
};

type AdminSupportSettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ channel?: string; error?: string; notice?: string }>;
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

async function getSupportContactRows(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    const { data: rows } = await supabase
      .from("support_contact_channels")
      .select("id,label,value,is_enabled,sort_order")
      .order("sort_order", { ascending: true });

    return (rows ?? []).map((row) => ({
      ...row,
      id: row.id as SupportChannelId,
    }));
  } catch {
    return [];
  }
}

export function SupportChannelSettingsForm({
  channel,
  channelHintKey,
  channelPlaceholders,
  isSaved = false,
  locale,
  t,
}: SupportChannelSettingsFormProps) {
  return (
    <form
      action={updateSupportContactChannel}
      aria-label={channel.label}
      className={`grid grid-cols-1 gap-4 px-4 py-5 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.85fr)_minmax(14rem,1.55fr)_minmax(12rem,240px)_minmax(8rem,120px)_minmax(9rem,160px)] xl:items-start ${
        isSaved ? "bg-emerald-50/60" : ""
      }`}
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/support-settings" />
      <input name="channel_id" type="hidden" value={channel.id} />
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.channel")}
        <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.label} name="label" />
        {channel.id === "email" ? <span className="text-xs leading-5 text-slate-500">{t("supportSettings.emailHelp")}</span> : null}
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.value")}
        <input
          className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={channel.value}
          name="value"
          placeholder={channelPlaceholders[channel.id] ?? ""}
        />
        <span className="text-xs leading-5 text-slate-500">{t(channelHintKey[channel.id] ?? "supportSettings.previewDescription")}</span>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.status")}
        <span className="inline-flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
          <span className="min-w-0 truncate text-sm text-slate-700">{channel.is_enabled ? t("supportSettings.enabled") : t("supportSettings.disabled")}</span>
          <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${channel.is_enabled ? "bg-slate-950" : "bg-slate-300"}`}>
            <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${channel.is_enabled ? "translate-x-5" : "translate-x-0"}`} />
            <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={channel.is_enabled} name="is_enabled" type="checkbox" />
          </span>
        </span>
        <span className="text-xs leading-5 text-slate-500">{t("supportSettings.statusHelp")}</span>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.sortOrder")}
        <input className="min-h-11 min-w-0 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.sort_order} min="1" name="sort_order" type="number" />
        <span className="text-xs leading-5 text-slate-500">{t("supportSettings.sortOrderHelp")}</span>
      </label>
      <div className="flex items-start md:col-span-2 xl:col-span-1 xl:pt-7">
        <div className="flex w-full flex-col gap-2">
          <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
            {t("supportSettings.save")}
          </AdminSubmitButton>
          {isSaved ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
              <p className="font-semibold">{t("supportSettings.rowSaved")}</p>
              <p className="mt-1">{t("supportSettings.rowSavedDescription")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export function PaymentMaintenanceForm({ isSaved = false, locale, status, t }: PaymentMaintenanceFormProps) {
  const message = status.message ?? defaultPaymentMaintenanceMessage;

  return (
    <form action={updatePaymentCheckoutMaintenance} className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,220px)_minmax(18rem,1fr)_minmax(9rem,180px)] lg:items-start">
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/support-settings" />
      <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
        {t("supportSettings.paymentMaintenanceStatus")}
        <span className="inline-flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-md border border-slate-300 px-3">
          <span className="min-w-0 truncate text-sm text-slate-700">
            {status.isPaused ? t("supportSettings.paymentMaintenancePaused") : t("supportSettings.paymentMaintenanceAvailable")}
          </span>
          <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${status.isPaused ? "bg-amber-500" : "bg-slate-950"}`}>
            <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${status.isPaused ? "translate-x-5" : "translate-x-0"}`} />
            <input aria-label={t("supportSettings.paymentMaintenanceStatus")} className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={status.isPaused} name="is_paused" type="checkbox" />
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
          {isSaved ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
              <p className="font-semibold">{t("supportSettings.rowSaved")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export default async function AdminSupportSettingsPage({ params, searchParams }: AdminSupportSettingsPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/support-settings`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/support-settings");
  const supabase = await createSupabaseServerClient();
  const defaults = getDefaultSupportChannelsConfig();
  const rows = await getSupportContactRows(supabase);
  const paymentCheckoutStatus = await getPaymentCheckoutStatus(supabase as unknown as PaymentCheckoutStatusClient);
  const channelRows = rows && rows.length > 0 ? rows : toSupportChannelRows(defaults);
  const previewChannels = normalizeSupportChannels({ defaults, rows: rows ?? [] });
  const channelPlaceholders: Record<string, string> = {
    discord: "https://discord.gg/your-community",
    email: "support@example.com",
    qq: "123456789",
    telegram: "https://t.me/your_channel",
    wechat: "your_wechat_id",
  };
  const channelHintKey: Record<string, string> = {
    discord: "supportSettings.valueHintDiscord",
    email: "supportSettings.valueHintEmail",
    qq: "supportSettings.valueHintQQ",
    telegram: "supportSettings.valueHintTelegram",
    wechat: "supportSettings.valueHintWeChat",
  };

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("supportSettings.description")}
          eyebrow={t("supportSettings.eyebrow")}
          title={t("supportSettings.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <AdminCard className="mb-6 p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.guidanceTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("supportSettings.guidanceBody")}</p>
        </AdminCard>

        <AdminCard className="mb-6 p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.paymentMaintenanceTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("supportSettings.paymentMaintenanceDescription")}</p>
          <PaymentMaintenanceForm
            isSaved={feedback?.notice === "payment-maintenance-updated"}
            locale={locale}
            status={paymentCheckoutStatus}
            t={t}
          />
        </AdminCard>

        <AdminCard>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.previewTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("supportSettings.previewDescription")}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {channelRows.map((channel) => (
              <SupportChannelSettingsForm
                channel={channel}
                channelHintKey={channelHintKey}
                channelPlaceholders={channelPlaceholders}
                isSaved={feedback?.notice === "support-contact-updated" && feedback?.channel === channel.id}
                key={channel.id}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </AdminCard>

        <AdminCard className="mt-6 p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.publicPreviewTitle")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("supportSettings.publicPreviewDescription")}</p>
          {previewChannels.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {previewChannels.map((channel) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3" key={channel.id}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700">
                      <channel.icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{channel.label}</p>
                      {channel.href ? (
                        <a className="mt-1 block break-all text-sm text-cyan-700 underline underline-offset-4 hover:text-cyan-800" href={channel.href} rel="noreferrer" target={channel.href.startsWith("mailto:") ? undefined : "_blank"}>
                          {channel.value}
                        </a>
                      ) : (
                        <p className="mt-1 break-all text-sm text-slate-600">{channel.value}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">{t("supportSettings.previewEmpty")}</p>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
