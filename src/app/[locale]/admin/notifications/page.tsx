import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { supportedLocales } from "@/config/site";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createNotification, publishNotification, unpublishNotification } from "../actions";

type AdminNotificationsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function AdminNotificationsPage({ params, searchParams }: AdminNotificationsPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/notifications`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/notifications");
  const { data: notifications, error } = await (await createSupabaseServerClient())
    .from("notifications")
    .select("id,title,body,locale,audience,priority,published_at,expires_at,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("notifications.description")}
          eyebrow={t("notifications.eyebrow")}
          title={t("notifications.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <AdminCard className="p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("notifications.createTitle")}</h2>
          <form action={createNotification} className="mt-4 grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="return_to" type="hidden" value="/admin/notifications" />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("notifications.titleLabel")}
                <input className="min-h-11 rounded-md border border-slate-300 px-3" maxLength={160} name="title" required />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("notifications.locale")}
                <select className="min-h-11 rounded-md border border-slate-300 px-3" name="notification_locale">
                  <option value="">{t("notifications.allLocales")}</option>
                  {supportedLocales.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              {t("notifications.body")}
              <textarea className="min-h-32 rounded-md border border-slate-300 px-3 py-2" maxLength={4000} name="body" required />
            </label>
            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("notifications.audience")}
                <select className="min-h-11 rounded-md border border-slate-300 px-3" name="audience" defaultValue="all">
                  <option value="all">all</option>
                  <option value="authenticated">authenticated</option>
                  <option value="admins">admins</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("notifications.priority")}
                <select className="min-h-11 rounded-md border border-slate-300 px-3" name="priority" defaultValue="info">
                  <option value="info">info</option>
                  <option value="success">success</option>
                  <option value="warning">warning</option>
                  <option value="critical">critical</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                {t("notifications.expiresAt")}
                <input className="min-h-11 rounded-md border border-slate-300 px-3" name="expires_at" type="datetime-local" />
              </label>
              <label className="flex min-h-11 items-end gap-2 text-sm font-medium text-slate-700">
                <input className="size-4" name="publish_now" type="checkbox" />
                {t("notifications.publish")}
              </label>
            </div>
            <AdminSubmitButton className="min-h-11 w-fit rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.processing")}>
              {t("notifications.create")}
            </AdminSubmitButton>
          </form>
        </AdminCard>

        <AdminCard className="mt-6">
          {notifications && notifications.length > 0 ? (
            <AdminTableShell label={t("notifications.title")}>
              <table aria-label={t("notifications.title")} className="min-w-[1090px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[360px]" />
                  <col className="w-[150px]" />
                  <col className="w-[140px]" />
                  <col className="w-[220px]" />
                  <col className="w-[220px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("notifications.titleLabel")}</th>
                    <th className="px-5 py-3">{t("notifications.audience")}</th>
                    <th className="px-5 py-3">{t("notifications.status")}</th>
                    <th className="px-5 py-3">{t("notifications.publishedAt")}</th>
                    <th className="sticky right-0 z-10 w-[220px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {notifications.map((notification) => (
                    <tr key={notification.id}>
                      <td className="min-w-80 px-5 py-4">
                        <p className="font-semibold text-slate-950">{notification.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.body}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{notification.audience}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <AdminStatusBadge tone={notification.published_at ? "success" : "neutral"}>
                          {notification.published_at ? t("notifications.published") : t("notifications.draft")}
                        </AdminStatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {notification.published_at ? formatDateTimeWithSeconds(notification.published_at, locale) : "-"}
                      </td>
                      <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                        <form action={notification.published_at ? unpublishNotification : publishNotification}>
                          <input name="locale" type="hidden" value={locale} />
                          <input name="return_to" type="hidden" value="/admin/notifications" />
                          <input name="notification_id" type="hidden" value={notification.id} />
                          <ConfirmActionButton
                            className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
                            confirmLabel={notification.published_at ? t("notifications.unpublish") : t("notifications.publish")}
                            pendingLabel={t("common.processing")}
                          >
                            {notification.published_at ? t("notifications.unpublish") : t("notifications.publish")}
                          </ConfirmActionButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("notifications.empty")}</p>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
