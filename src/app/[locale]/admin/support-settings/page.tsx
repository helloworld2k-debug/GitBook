import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { PaymentMaintenanceForm, SupportChannelSettingsForm } from "@/components/admin/admin-support-settings-forms";
import { getDefaultSupportChannelsConfig, normalizeSupportChannels, toSupportChannelRows, type SupportChannelId } from "@/config/support";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { getPaymentCheckoutStatus, type PaymentCheckoutStatusClient } from "@/lib/payments/maintenance";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminSupportSettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ channel?: string; error?: string; notice?: string }>;
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
