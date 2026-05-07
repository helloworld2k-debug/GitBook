import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { replySupportFeedbackAsAdmin, updateSupportFeedbackStatus } from "../../actions";

type AdminSupportFeedbackDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

type FeedbackStatus = "open" | "reviewing" | "closed";

function statusTone(status: FeedbackStatus) {
  if (status === "closed") return "success";
  if (status === "reviewing") return "warning";
  return "neutral";
}

export default async function AdminSupportFeedbackDetailPage({ params, searchParams }: AdminSupportFeedbackDetailPageProps) {
  const { id, locale: localeParam } = await params;
  const feedbackState = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/support-feedback/${id}`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, `/admin/support-feedback/${id}`);
  const supabase = createSupabaseAdminClient();
  const { data: feedback, error } = await supabase
    .from("support_feedback")
    .select("id,email,contact,subject,message,status,created_at,updated_at,user_id")
    .eq("id", id)
    .single();

  if (error || !feedback) {
    notFound();
  }

  const { data: messages, error: messagesError } = await supabase
    .from("support_feedback_messages")
    .select("id,author_role,body,created_at,user_id,admin_user_id")
    .eq("feedback_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-5xl">
        <AdminPageHeader
          backHref="/admin/support-feedback"
          backLabel={t("supportFeedback.backToFeedback")}
          description={t("supportFeedback.description")}
          eyebrow={t("supportFeedback.eyebrow")}
          title={feedback.subject}
        />
        <AdminFeedbackBanner error={feedbackState?.error} notice={feedbackState?.notice} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <AdminCard className="p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-slate-600">{feedback.email ?? "-"}</p>
                <p className="mt-1 break-words text-xs text-slate-500">{feedback.contact ?? "-"}</p>
              </div>
              <AdminStatusBadge tone={statusTone(feedback.status as FeedbackStatus)}>
                {t(`supportFeedback.statuses.${feedback.status as FeedbackStatus}`)}
              </AdminStatusBadge>
            </div>
            <article className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{t("supportFeedback.originalMessage")}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{feedback.message}</p>
              <p className="mt-3 text-xs text-slate-500">{formatDateTimeWithSeconds(feedback.created_at, locale)}</p>
            </article>
            <div className="mt-6 grid gap-3">
              <h2 className="text-base font-semibold text-slate-950">{t("supportFeedback.conversation")}</h2>
              {messages && messages.length > 0 ? messages.map((message) => (
                <article
                  className={`rounded-md border p-4 ${
                    message.author_role === "admin" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                  key={message.id}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-950">
                      {message.author_role === "admin" ? t("supportFeedback.adminMessage") : t("supportFeedback.userMessage")}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTimeWithSeconds(message.created_at, locale)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message.body}</p>
                </article>
              )) : <p className="text-sm text-slate-600">{t("supportFeedback.emptyConversation")}</p>}
            </div>
            <form action={replySupportFeedbackAsAdmin} className="mt-6 grid gap-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/support-feedback/${feedback.id}`} />
              <input name="feedback_id" type="hidden" value={feedback.id} />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {t("supportFeedback.reply")}
                <textarea className="min-h-32 rounded-md border border-slate-300 px-3 py-3 text-sm" maxLength={4000} name="message" placeholder={t("supportFeedback.replyPlaceholder")} required />
              </label>
              <AdminSubmitButton className="inline-flex min-h-11 w-fit items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.processing")}>
                {t("supportFeedback.sendReply")}
              </AdminSubmitButton>
            </form>
          </AdminCard>
          <AdminCard className="h-fit p-5">
            <h2 className="text-base font-semibold text-slate-950">{t("supportFeedback.status")}</h2>
            <form action={updateSupportFeedbackStatus} className="mt-4 grid gap-3">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value={`/admin/support-feedback/${feedback.id}`} />
              <input name="feedback_id" type="hidden" value={feedback.id} />
              <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" name="status" defaultValue={feedback.status}>
                <option value="open">{t("supportFeedback.statuses.open")}</option>
                <option value="reviewing">{t("supportFeedback.statuses.reviewing")}</option>
                <option value="closed">{t("supportFeedback.statuses.closed")}</option>
              </select>
              <AdminSubmitButton className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={t("common.saving")}>
                {t("supportFeedback.save")}
              </AdminSubmitButton>
            </form>
          </AdminCard>
        </div>
      </section>
    </AdminShell>
  );
}
