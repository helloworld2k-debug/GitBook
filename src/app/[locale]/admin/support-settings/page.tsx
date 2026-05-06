import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getDefaultSupportChannelsConfig, normalizeSupportChannels, toSupportChannelRows } from "@/config/support";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";
import { getManageableDonationTiers } from "@/lib/payments/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDonationTier, updateSupportContactChannel } from "../actions";

type AdminSupportSettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ channel?: string; error?: string; notice?: string }>;
};

function formatDollarInput(amountInCents: number | null | undefined) {
  const amount = (amountInCents ?? 0) / 100;

  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getDiscountPercent(amount: number, compareAtAmount: number | null) {
  if (!compareAtAmount || compareAtAmount <= amount) {
    return 0;
  }

  return Math.round((1 - amount / compareAtAmount) * 100);
}

async function getSupportContactRows(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    const { data: rows } = await supabase
      .from("support_contact_channels")
      .select("id,label,value,is_enabled,sort_order")
      .order("sort_order", { ascending: true });

    return rows ?? [];
  } catch {
    return [];
  }
}

export default async function AdminSupportSettingsPage({ params, searchParams }: AdminSupportSettingsPageProps) {
  const { locale } = await params;
  const feedback = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale, `/${locale}/admin/support-settings`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/support-settings");
  const supabase = await createSupabaseServerClient();
  const defaults = getDefaultSupportChannelsConfig();
  const rows = await getSupportContactRows(supabase);
  const channelRows = rows && rows.length > 0 ? rows : toSupportChannelRows(defaults);
  const donationTierRows = await getManageableDonationTiers(supabase);
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

        <AdminCard className="mb-6">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.tiersTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("supportSettings.tiersDescription")}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {donationTierRows.map((tier) => (
              <form
                action={updateDonationTier}
                className={`grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_150px_170px_170px_150px] ${
                  feedback?.notice === "donation-tier-updated" && feedback?.channel === tier.id
                    ? "bg-emerald-50/60"
                    : ""
                }`}
                key={tier.id}
              >
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value={`/admin/support-settings?channel=${tier.id}`} />
                <input name="tier_id" type="hidden" value={tier.id} />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.tierLabel")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={tier.label} name="label" required />
                  <span className="font-mono text-xs text-slate-500">{tier.code}</span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.tierDescription")}
                  <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={tier.description} name="description" required />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.tierPrice")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={formatDollarInput(tier.compareAtAmount ?? tier.amount)}
                    min="0.01"
                    name="price"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.tierDiscountPercent")}
                  <input
                    className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={getDiscountPercent(tier.amount, tier.compareAtAmount)}
                    max="99"
                    min="0"
                    name="discount_percent"
                    required
                    step="1"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.status")}
                  <span className="inline-flex min-h-11 items-center justify-between rounded-md border border-slate-300 px-3">
                    <span className="text-sm text-slate-700">{tier.isActive ? t("supportSettings.tierActive") : t("supportSettings.tierInactive")}</span>
                    <span className={`relative ml-3 inline-flex h-6 w-11 items-center rounded-full transition-colors ${tier.isActive ? "bg-slate-950" : "bg-slate-300"}`}>
                      <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${tier.isActive ? "translate-x-5" : "translate-x-0"}`} />
                      <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={tier.isActive} name="is_active" type="checkbox" />
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{t("supportSettings.tierStatusHelp")}</span>
                </label>
                <div className="flex items-end">
                  <div className="flex w-full flex-col gap-2">
                    <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
                      {t("supportSettings.save")}
                    </AdminSubmitButton>
                    {feedback?.notice === "donation-tier-updated" && feedback?.channel === tier.id ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        <p className="font-semibold">{t("supportSettings.tierSaved")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">{t("supportSettings.previewTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("supportSettings.previewDescription")}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {channelRows.map((channel) => (
              <form
                action={updateSupportContactChannel}
                className={`grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)_240px_120px_160px] ${
                  feedback?.notice === "support-contact-updated" && feedback?.channel === channel.id
                    ? "bg-emerald-50/60"
                    : ""
                }`}
                key={channel.id}
              >
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
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.value} name="value" placeholder={channelPlaceholders[channel.id] ?? ""} />
                  <span className="text-xs text-slate-500">{t(channelHintKey[channel.id] ?? "supportSettings.previewDescription")}</span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.status")}
                  <span className="inline-flex min-h-11 items-center justify-between rounded-md border border-slate-300 px-3">
                    <span className="text-sm text-slate-700">{channel.is_enabled ? t("supportSettings.enabled") : t("supportSettings.disabled")}</span>
                    <span className={`relative ml-3 inline-flex h-6 w-11 items-center rounded-full transition-colors ${channel.is_enabled ? "bg-slate-950" : "bg-slate-300"}`}>
                      <span className={`absolute left-1 size-4 rounded-full bg-white shadow-sm transition-transform ${channel.is_enabled ? "translate-x-5" : "translate-x-0"}`} />
                      <input className="absolute inset-0 cursor-pointer opacity-0" defaultChecked={channel.is_enabled} name="is_enabled" type="checkbox" />
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{t("supportSettings.statusHelp")}</span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("supportSettings.sortOrder")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={channel.sort_order} min="1" name="sort_order" type="number" />
                  <span className="text-xs text-slate-500">{t("supportSettings.sortOrderHelp")}</span>
                </label>
                <div className="flex items-end">
                  <div className="flex w-full flex-col gap-2">
                    <AdminSubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
                      {t("supportSettings.save")}
                    </AdminSubmitButton>
                    {feedback?.notice === "support-contact-updated" && feedback?.channel === channel.id ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        <p className="font-semibold">{t("supportSettings.rowSaved")}</p>
                        <p className="mt-1">{t("supportSettings.rowSavedDescription")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
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
