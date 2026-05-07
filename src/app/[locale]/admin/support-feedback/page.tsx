import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { enrichFeedbackUnreadState, type FeedbackUnreadSource } from "@/lib/admin/support-feedback-unread";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateSupportFeedbackStatus } from "../actions";

type AdminSupportFeedbackPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; filter?: string; notice?: string }>;
};

type FeedbackStatus = "open" | "reviewing" | "closed";

type AdminFeedbackRow = FeedbackUnreadSource & {
  contact: string | null;
  email: string | null;
  message: string;
  status: FeedbackStatus;
  subject: string;
  updated_at: string;
};

function statusTone(status: FeedbackStatus) {
  if (status === "closed") return "success";
  if (status === "reviewing") return "warning";
  return "neutral";
}

function isUnreadTrackingSchemaError(error: { code?: string; message?: string } | null) {
  const code = error?.code;
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "42P01" ||
    message.includes("support_feedback_admin_reads") ||
    message.includes("schema cache")
  );
}

export default async function AdminSupportFeedbackPage({ params, searchParams }: AdminSupportFeedbackPageProps) {
  const { locale: localeParam } = await params;
  const feedbackState = await searchParams;

  const { locale, user } = await setupAdminPage(localeParam, `/${localeParam}/admin/support-feedback`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/support-feedback");
  const supabase = await createSupabaseServerClient();
  const feedbackResult = await supabase
    .from("support_feedback")
    .select("id,email,contact,subject,message,status,created_at,updated_at,support_feedback_admin_reads(admin_user_id,read_at),support_feedback_messages(author_role,created_at)")
    .order("updated_at", { ascending: false })
    .limit(100);

  let feedback = (feedbackResult.data ?? []) as AdminFeedbackRow[];
  let unreadTrackingAvailable = true;

  if (feedbackResult.error) {
    if (!isUnreadTrackingSchemaError(feedbackResult.error)) {
      throw feedbackResult.error;
    }

    const fallbackResult = await supabase
      .from("support_feedback")
      .select("id,email,contact,subject,message,status,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    unreadTrackingAvailable = false;
    feedback = (fallbackResult.data ?? []) as AdminFeedbackRow[];
  }
  const filter = unreadTrackingAvailable && feedbackState?.filter === "unread" ? "unread" : "all";
  const feedbackWithUnreadState = (unreadTrackingAvailable
    ? enrichFeedbackUnreadState(feedback, user.id)
    : feedback.map((item) => ({
        ...item,
        adminReadAt: null,
        isUnread: false,
        latestUserMessageAt: item.updated_at ?? item.created_at,
      })))
    .sort((a, b) => {
      if (a.isUnread !== b.isUnread) {
        return a.isUnread ? -1 : 1;
      }

      return new Date(b.latestUserMessageAt ?? b.created_at).getTime() - new Date(a.latestUserMessageAt ?? a.created_at).getTime();
    });
  const visibleFeedback = filter === "unread" ? feedbackWithUnreadState.filter((item) => item.isUnread) : feedbackWithUnreadState;

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
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
              filter === "all" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
            href="/admin/support-feedback"
          >
            {t("supportFeedback.allFeedback")}
          </Link>
          <Link
            className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
              filter === "unread" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
            href="/admin/support-feedback?filter=unread"
          >
            {t("supportFeedback.unreadFeedback")}
          </Link>
        </div>
        <AdminCard>
          {visibleFeedback.length > 0 ? (
            <AdminTableShell
              label={t("supportFeedback.title")}
              mobileCards={
                <div className="grid gap-3">
                  {visibleFeedback.map((item) => (
                    <article className={`rounded-lg border bg-white p-4 shadow-sm ${item.isUnread ? "border-rose-200 ring-1 ring-rose-100" : "border-slate-200"}`} key={item.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link className="break-words text-sm font-semibold text-slate-950 underline-offset-4 hover:underline" href={`/admin/support-feedback/${item.id}`}>
                            {item.subject}
                          </Link>
                          <p className="mt-1 break-all text-sm text-slate-600">{item.email ?? "-"}</p>
                          <p className="text-xs text-slate-500">{item.contact ?? "-"}</p>
                        </div>
                        <AdminStatusBadge tone={statusTone(item.status as FeedbackStatus)}>
                          {t(`supportFeedback.statuses.${item.status as FeedbackStatus}`)}
                        </AdminStatusBadge>
                        {item.isUnread ? (
                          <span className="inline-flex min-h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700">
                            {t("supportFeedback.unread")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.message}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">{formatDateTimeWithSeconds(item.created_at, locale)}</p>
                        <Link className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" href={`/admin/support-feedback/${item.id}`}>
                          {t("supportFeedback.view")}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              }
            >
                <table aria-label={t("supportFeedback.title")} className="min-w-[1540px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[220px]" />
                  <col className="w-[110px]" />
                  <col className="w-[260px]" />
                  <col className="w-[320px]" />
                  <col className="w-[140px]" />
                  <col className="w-[270px]" />
                  <col className="w-[220px]" />
                </colgroup>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("supportFeedback.subject")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.unread")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.contact")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.message")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.status")}</th>
                    <th className="px-5 py-3">{t("supportFeedback.createdAt")}</th>
                    <th className="border-l border-slate-200 px-5 py-3">{t("licenses.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleFeedback.map((item) => (
                    <tr className={item.isUnread ? "bg-rose-50/40" : ""} key={item.id}>
                      <td className="min-w-56 px-5 py-4 font-medium text-slate-950">
                        <Link className="underline-offset-4 hover:underline" href={`/admin/support-feedback/${item.id}`}>
                          {item.subject}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {item.isUnread ? (
                          <span className="inline-flex min-h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700">
                            {t("supportFeedback.unread")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
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
                      <td className="border-l border-slate-200 px-5 py-4">
                        <form action={updateSupportFeedbackStatus} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                          <input name="locale" type="hidden" value={locale} />
                          <input name="return_to" type="hidden" value="/admin/support-feedback" />
                          <input name="feedback_id" type="hidden" value={item.id} />
                          <select className="min-h-10 min-w-0 rounded-md border border-slate-300 px-2 text-sm" name="status" defaultValue={item.status}>
                            <option value="open">{t("supportFeedback.statuses.open")}</option>
                            <option value="reviewing">{t("supportFeedback.statuses.reviewing")}</option>
                            <option value="closed">{t("supportFeedback.statuses.closed")}</option>
                          </select>
                          <AdminSubmitButton className="min-h-10 whitespace-nowrap rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" pendingLabel={t("common.saving")}>
                            {t("supportFeedback.save")}
                          </AdminSubmitButton>
                        </form>
                        <Link className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" href={`/admin/support-feedback/${item.id}`}>
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
