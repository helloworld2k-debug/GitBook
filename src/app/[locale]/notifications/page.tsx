import { getTranslations } from "next-intl/server";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  params: Promise<{ locale: string }>;
};

function priorityClass(priority: string) {
  if (priority === "critical") return "border-red-300/30 bg-red-400/10 text-red-100";
  if (priority === "warning") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (priority === "success") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);
  const t = await getTranslations("notifications");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  let query = supabase
    .from("notifications")
    .select("id,title,body,priority,published_at,notification_reads(read_at,user_id)")
    .not("published_at", "is", null)
    .lte("published_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`locale.is.null,locale.eq.${locale}`)
    .order("published_at", { ascending: false })
    .limit(50);

  query = auth.user ? query.in("audience", ["all", "authenticated"]) : query.eq("audience", "all");

  const { data: notifications, error } = await query;

  if (error) {
    throw error;
  }

  const markRead = markNotificationRead.bind(null, locale);

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{t("subtitle")}</p>

          <div className="mt-8 space-y-4">
            {notifications && notifications.length > 0 ? notifications.map((notification) => {
              const isRead = Boolean(notification.notification_reads?.some((read) => read.user_id === auth.user?.id));

              return (
                <article className="glass-panel rounded-lg p-5" key={notification.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold ${priorityClass(notification.priority)}`}>
                        {notification.priority}
                      </span>
                      <h2 className="mt-3 text-xl font-semibold text-white">{notification.title}</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{notification.body}</p>
                      <p className="mt-4 text-xs text-slate-500">
                        {t("published")} {formatDateTimeWithSeconds(notification.published_at, locale)}
                      </p>
                    </div>
                    {auth.user && !isRead ? (
                      <form action={markRead}>
                        <input name="notification_id" type="hidden" value={notification.id} />
                        <button className="min-h-10 rounded-md border border-cyan-300/20 px-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300/10" type="submit">
                          {t("markRead")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <p className="glass-panel rounded-lg px-5 py-6 text-sm text-slate-300">{t("empty")}</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
