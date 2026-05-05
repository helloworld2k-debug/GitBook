import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getDefaultSupportChannelsConfig, normalizeSupportChannels, toSupportChannelRows } from "@/config/support";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSupportContactChannel } from "../actions";

type AdminSupportSettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function AdminSupportSettingsPage({ params, searchParams }: AdminSupportSettingsPageProps) {
  const { locale } = await params;
  const feedback = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/support-settings");
  const supabase = await createSupabaseServerClient();
  const defaults = getDefaultSupportChannelsConfig();
  const { data: rows } = await supabase
    .from("support_contact_channels")
    .select("id,label,value,is_enabled,sort_order")
    .order("sort_order", { ascending: true });

  const channelRows = rows && rows.length > 0 ? rows : toSupportChannelRows(defaults);
  const previewChannels = normalizeSupportChannels({ defaults, rows: rows ?? [] });

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

        <AdminCard>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("supportSettings.previewDescription")}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {channelRows.map((channel) => (
              <form action={updateSupportContactChannel} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_140px_140px_auto]" key={channel.id}>
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value="/admin/support-settings" />
                <input name="channel_id" type="hidden" value={channel.id} />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.channel")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.label} name="label" />
                  {channel.id === "email" ? <span className="text-xs text-slate-500">{t("supportSettings.emailHelp")}</span> : null}
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.value")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.value} name="value" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.status")}
                  <span className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3">
                    <input className="size-4 rounded border-slate-300" defaultChecked={channel.is_enabled} name="is_enabled" type="checkbox" />
                    <span className="ml-2 text-sm text-slate-700">{channel.is_enabled ? t("supportSettings.enabled") : t("supportSettings.disabled")}</span>
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.sortOrder")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.sort_order} min="1" name="sort_order" type="number" />
                </label>
                <div className="flex items-end">
                  <AdminSubmitButton className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
                    {t("supportSettings.save")}
                  </AdminSubmitButton>
                </div>
              </form>
            ))}
          </div>
        </AdminCard>

        <AdminCard className="mt-6 p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.previewTitle")}</h2>
          {previewChannels.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {previewChannels.map((channel) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3" key={channel.id}>
                  <p className="text-sm font-semibold text-slate-950">{channel.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{channel.value}</p>
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
