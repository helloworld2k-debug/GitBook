import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormStatusBanner } from "@/components/form-status-banner";
import { FormSubmitButton } from "@/components/form-submit-button";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { replySupportFeedback } from "../../actions";

type SupportFeedbackThreadPageProps = {
  params: Promise<{ id: string; locale: string }>;
  searchParams?: Promise<{ reply?: string }>;
};

export default async function SupportFeedbackThreadPage({ params, searchParams }: SupportFeedbackThreadPageProps) {
  const { id, locale } = await params;
  const status = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/support/feedback/${id}`);
  const t = await getTranslations("support");
  const supabase = createSupabaseAdminClient();
  const { data: feedback, error } = await supabase
    .from("support_feedback")
    .select("id,subject,message,status,created_at,user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !feedback) {
    notFound();
  }

  const { data: messages, error: messagesError } = await supabase
    .from("support_feedback_messages")
    .select("id,author_role,body,created_at")
    .eq("feedback_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  const replyAction = replySupportFeedback.bind(null, locale, id);

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <Link className="inline-flex min-h-10 items-center rounded-md border border-cyan-300/20 px-3 text-sm font-semibold text-cyan-100" href="/support">
            {t("backToSupport")}
          </Link>
          <div className="mt-5 glass-panel rounded-lg p-5">
            <p className="text-sm font-semibold uppercase text-cyan-100">{t(`statuses.${feedback.status}`)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">{feedback.subject}</h1>
            <p className="mt-2 text-sm text-slate-400">{formatDateTimeWithSeconds(feedback.created_at, locale)}</p>
            <div className="mt-6 rounded-md border border-cyan-300/15 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase text-cyan-100">{t("originalMessage")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">{feedback.message}</p>
            </div>
            <div className="mt-6 grid gap-3">
              <h2 className="text-lg font-semibold text-white">{t("conversationTitle")}</h2>
              {messages && messages.length > 0 ? messages.map((message) => (
                <article
                  className={`rounded-md border p-4 ${
                    message.author_role === "admin"
                      ? "border-emerald-300/25 bg-emerald-300/10"
                      : "border-cyan-300/15 bg-slate-950/60"
                  }`}
                  key={message.id}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-white">
                      {message.author_role === "admin" ? t("adminMessage") : t("userMessage")}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTimeWithSeconds(message.created_at, locale)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">{message.body}</p>
                </article>
              )) : <p className="text-sm text-slate-300">{t("conversationEmpty")}</p>}
            </div>
            {status?.reply === "saved" ? <div className="mt-4"><FormStatusBanner message={t("replySuccess")} /></div> : null}
            {status?.reply === "error" ? <div className="mt-4"><FormStatusBanner message={t("replyError")} tone="error" /></div> : null}
            <form action={replyAction} className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-slate-100">
                {t("reply")}
                <textarea className="min-h-32 rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 py-3 text-white" maxLength={4000} name="message" placeholder={t("replyPlaceholder")} required />
              </label>
              <FormSubmitButton className="neon-button min-h-11 w-fit rounded-md px-4 text-sm font-semibold text-white" pendingLabel={t("sendReply")}>
                {t("sendReply")}
              </FormSubmitButton>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
