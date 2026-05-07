import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FormStatusBanner } from "@/components/form-status-banner";
import { FormSubmitButton } from "@/components/form-submit-button";
import { supportedLocales, type Locale } from "@/config/site";
import { getDefaultSupportChannelsConfig, normalizeSupportChannels } from "@/config/support";
import { Link } from "@/i18n/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitSupportFeedback } from "./actions";

export const dynamic = "force-dynamic";

type SupportPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ feedback?: string }>;
};

export default async function SupportPage({ params, searchParams }: SupportPageProps) {
  const { locale } = await params;
  const status = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("support");
  const submitFeedback = submitSupportFeedback.bind(null, locale);
  const supabase = await createSupabaseServerClient();
  const defaults = getDefaultSupportChannelsConfig();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { data: channelRows } = await supabase
    .from("support_contact_channels")
    .select("id,label,value,is_enabled,sort_order")
    .order("sort_order", { ascending: true });
  const channels = normalizeSupportChannels({
    defaults,
    rows: channelRows ?? [],
  });
  const { data: feedback } = user
    ? await supabase
      .from("support_feedback")
      .select("id,subject,status,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(8)
    : { data: [] };

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
          <div>
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{t("subtitle")}</p>

            <section className="mt-8 glass-panel rounded-lg p-5">
              <h2 className="text-lg font-semibold text-white">{t("channelsTitle")}</h2>
              {channels.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {channels.map((channel) => {
                    const Icon = channel.icon;
                    const content = (
                      <>
                        <span className="flex size-10 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          <Icon aria-hidden="true" className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">{channel.label}</span>
                          <span className="block truncate text-sm text-slate-300">{channel.value}</span>
                        </span>
                      </>
                    );

                    return channel.href ? (
                      <a
                        className="flex min-h-16 items-center gap-3 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3 transition-colors hover:border-cyan-300/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                        aria-label={`${channel.label} ${channel.value}`}
                        href={channel.href}
                        key={channel.id}
                        rel="noreferrer"
                        target={channel.href.startsWith("mailto:") ? undefined : "_blank"}
                      >
                        {content}
                      </a>
                    ) : (
                      <div className="flex min-h-16 items-center gap-3 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3" key={channel.id}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3 py-3 text-sm text-cyan-50">
                  {t("channelsEmpty")}
                </p>
              )}
            </section>
          </div>

          <section className="glass-panel rounded-lg p-5">
            <h2 className="text-lg font-semibold text-white">{t("formTitle")}</h2>
            {status?.feedback === "saved" ? <div className="mt-4"><FormStatusBanner message={t("success")} /></div> : null}
            {status?.feedback === "error" ? <div className="mt-4"><FormStatusBanner message={t("error")} tone="error" /></div> : null}
            {user ? (
              <form action={submitFeedback} className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-100">
                  {t("contact")}
                  <input className="min-h-11 rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-white" maxLength={200} name="contact" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-100">
                  {t("subject")}
                  <input className="min-h-11 rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-white" maxLength={180} name="subject" required />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-100">
                  {t("message")}
                  <textarea className="min-h-36 rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 py-3 text-white" maxLength={4000} name="message" required />
                </label>
                <FormSubmitButton className="neon-button min-h-11 rounded-md px-4 text-sm font-semibold text-white" pendingLabel={t("submit")}>
                  {t("submit")}
                </FormSubmitButton>
              </form>
            ) : (
              <div className="mt-4">
                <div className="rounded-md border border-cyan-300/20 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold text-white">{t("signInRequiredTitle")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("signInRequiredDescription")}</p>
                </div>
                <form className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-slate-100">
                    {t("contact")}
                    <input className="min-h-11 rounded-md border border-cyan-300/20 bg-slate-950/40 px-3 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70" disabled maxLength={200} name="contact" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-100">
                    {t("subject")}
                    <input className="min-h-11 rounded-md border border-cyan-300/20 bg-slate-950/40 px-3 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70" disabled maxLength={180} name="subject" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-100">
                    {t("message")}
                    <textarea className="min-h-36 rounded-md border border-cyan-300/20 bg-slate-950/40 px-3 py-3 text-slate-400 disabled:cursor-not-allowed disabled:opacity-70" disabled maxLength={4000} name="message" />
                  </label>
                  <Link className="neon-button inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-white" href={`/login?next=${encodeURIComponent(`/${locale}/support`)}`}>
                    {t("signInToSubmit")}
                  </Link>
                </form>
              </div>
            )}
          </section>
        </section>
        {user ? (
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <div className="glass-panel rounded-lg p-5">
              <h2 className="text-lg font-semibold text-white">{t("myFeedbackTitle")}</h2>
              {feedback && feedback.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {feedback.map((item) => (
                    <Link
                      className="flex min-h-16 flex-col justify-center gap-1 rounded-md border border-cyan-300/15 bg-slate-950/60 px-4 transition-colors hover:border-cyan-300/40 sm:flex-row sm:items-center sm:justify-between"
                      href={`/support/feedback/${item.id}`}
                      key={item.id}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{item.subject}</span>
                        <span className="block text-xs uppercase text-cyan-100">{t(`statuses.${item.status}`)}</span>
                      </span>
                      <span className="text-sm font-medium text-cyan-100">{t("viewThread")}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-300">{t("myFeedbackEmpty")}</p>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
