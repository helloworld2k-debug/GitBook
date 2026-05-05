import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSupportFeedbackStatus } from "../actions";

type AdminSupportFeedbackPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

type FeedbackStatus = "open" | "reviewing" | "closed";

function statusTone(status: FeedbackStatus) {
  if (status === "closed") return "success";
  if (status === "reviewing") return "warning";
  return "neutral";
}

export default async function AdminSupportFeedbackPage({ params, searchParams }: AdminSupportFeedbackPageProps) {
  const { locale } = await params;
  const feedbackState = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/support-feedback");
  const { data: feedback, error } = await (await createSupabaseServerClient())
    .from("support_feedback")
    .select("id,email,contact,subject,message,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("supportFeedback.description")}
          eyebrow={t("supportFeedback.eyebrow")}
          title={t("supportFeedback.title")}
        />
        <AdminFeedbackBanner error={feedbackState?.error} notice={feedbackState?.notice} />
        <AdminCard>
          {feedback && feedback.length > 0 ? (
            <AdminTableShell label={t("supportFeedback.title")}>
                <table aria-label={t("supportFeedback.title")} className="min-w-[1180px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[230px]" />
                  <col className="w-[240px]" />
                  <col className="w-[320px]" />
                  <col className="w-[140px]" />
                  <col className="w-[220px]" />
                  <col className="w-[160px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("supportFeedback.subject")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.contact")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.message")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.status")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.createdAt")}</th>
                    <th className="px-5 py-3">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {feedback.map((item) => (
                    <tr key={item.id}>
                      <td className="min-w-56 px-5 py-4 font-medium text-slate-950">
                        <Link className="underline-offset-4 hover:underline" href={`/admin/support-feedback/${item.id}`}>
                          {item.subject}
                        </Link>
                      </td>
                      <td className="min-w-56 px-5 py-4 text-slate-700">
                        <span className="block">{item.email ?? "-"}</span>
                        <span className="block text-xs text-slate-500">{item.contact ?? "-"}</span>
                      </td>
                      <td className="max-w-md px-5 py-4 text-slate-700">
                        <p className="line-clamp-3 whitespace-pre-wrap break-words">{item.message}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <AdminStatusBadge tone={statusTone(item.status as FeedbackStatus)}>
                          {t(`supportFeedback.statuses.${item.status as FeedbackStatus}`)}
                        </AdminStatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {formatDateTimeWithSeconds(item.created_at, locale)}
                      </td>
                      <td className="px-5 py-4">
                        <form action={updateSupportFeedbackStatus} className="flex gap-2">
                          <input name="locale" type="hidden" value={locale} />
                          <input name="return_to" type="hidden" value="/admin/support-feedback" />
                          <input name="feedback_id" type="hidden" value={item.id} />
                          <select className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="status" defaultValue={item.status}>
                            <option value="open">{t("supportFeedback.statuses.open")}</option>
                            <option value="reviewing">{t("supportFeedback.statuses.reviewing")}</option>
                            <option value="closed">{t("supportFeedback.statuses.closed")}</option>
                          </select>
                          <AdminSubmitButton className="min-h-10 whitespace-nowrap rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={t("common.saving")}>
                            {t("supportFeedback.save")}
                          </AdminSubmitButton>
                        </form>
                        <Link className="mt-2 inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" href={`/admin/support-feedback/${item.id}`}>
                          {t("supportFeedback.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("supportFeedback.empty")}</p>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
