import { getTranslations } from "next-intl/server";
import { AdminCard, AdminDataWorkbench, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminWorkbenchHeader } from "@/components/admin/admin-workbench-header";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { enrichFeedbackUnreadState, type FeedbackUnreadSource } from "@/lib/admin/support-feedback-unread";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupportFeedbackTableRow } from "./support-feedback-table-row";
import enMessages from "../../../../../messages/en.json";
import jaMessages from "../../../../../messages/ja.json";
import koMessages from "../../../../../messages/ko.json";
import zhHantMessages from "../../../../../messages/zh-Hant.json";

type AdminSupportFeedbackPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    error?: string;
    filter?: string;
    notice?: string;
    page?: string;
    query?: string;
  }>;
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

const supportFeedbackConfirmChangeTemplates: Record<string, string> = {
  en: enMessages.admin.supportFeedback.confirmChange,
  ja: jaMessages.admin.supportFeedback.confirmChange,
  ko: koMessages.admin.supportFeedback.confirmChange,
  "zh-Hant": zhHantMessages.admin.supportFeedback.confirmChange,
};

function getSupportFeedbackConfirmChangeTemplate(locale: string) {
  return supportFeedbackConfirmChangeTemplates[locale] ?? supportFeedbackConfirmChangeTemplates.en;
}

export default async function AdminSupportFeedbackPage({ params, searchParams }: AdminSupportFeedbackPageProps) {
  const { locale: localeParam } = await params;
  const feedbackState = await searchParams;

  const { locale, user } = await setupAdminPage(localeParam, `/${localeParam}/admin/support-feedback`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/support-feedback");
  const supabase = await createSupabaseServerClient();
  const tableRowLabels = {
    open: t("supportFeedback.statuses.open"),
    reviewing: t("supportFeedback.statuses.reviewing"),
    closed: t("supportFeedback.statuses.closed"),
    save: t("supportFeedback.save"),
    saving: t("common.saving"),
    confirmChange: getSupportFeedbackConfirmChangeTemplate(locale),
    unread: t("supportFeedback.unread"),
    view: t("supportFeedback.view"),
  };

  const queryParam = feedbackState?.query;
  let query = supabase
    .from("support_feedback")
    .select("id,email,contact,subject,message,status,created_at,updated_at,support_feedback_admin_reads(admin_user_id,read_at),support_feedback_messages(author_role,created_at)");

  if (queryParam) {
    query = query.or(`subject.ilike.%${queryParam}%,message.ilike.%${queryParam}%,email.ilike.%${queryParam}%`);
  }

  const feedbackResult = await query
    .order("updated_at", { ascending: false });

  let feedback = (feedbackResult.data ?? []) as AdminFeedbackRow[];
  let unreadTrackingAvailable = true;

  if (feedbackResult.error) {
    if (!isUnreadTrackingSchemaError(feedbackResult.error)) {
      throw feedbackResult.error;
    }

    const fallbackQuery = supabase
      .from("support_feedback")
      .select("id,email,contact,subject,message,status,created_at,updated_at");

    if (queryParam) {
      fallbackQuery.or(`subject.ilike.%${queryParam}%,message.ilike.%${queryParam}%,email.ilike.%${queryParam}%`);
    }

    const fallbackResult = await fallbackQuery
      .order("updated_at", { ascending: false });

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

  const buildFilterUrl = (newFilter: string | null) => {
    const params = new URLSearchParams();
    if (newFilter === "unread") params.set("filter", "unread");
    if (queryParam) params.set("query", queryParam);
    const queryString = params.toString();
    return queryString ? `/admin/support-feedback?${queryString}` : "/admin/support-feedback";
  };

  // Pagination for feedback
  const PAGE_SIZE = 20;
  const currentPage = Number(feedbackState?.page ?? 1);
  const totalPages = Math.ceil(visibleFeedback.length / PAGE_SIZE);
  const paginatedFeedback = visibleFeedback.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationBasePath = buildFilterUrl(filter === "unread" ? "unread" : null);

  return (
    <AdminShell {...shellProps}>
      <AdminDataWorkbench>
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("supportFeedback.description")}
          eyebrow={t("supportFeedback.eyebrow")}
          title={t("supportFeedback.title")}
        />
        <AdminFeedbackBanner error={feedbackState?.error} notice={feedbackState?.notice} />
        <AdminWorkbenchHeader
          description={t("supportFeedback.description")}
          filters={
            <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <form action="/admin/support-feedback">
                <input
                  className="min-h-11 w-full max-w-md rounded-md border border-slate-300 px-3 text-sm shadow-sm focus:border-slate-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  defaultValue={queryParam ?? ""}
                  name="query"
                  placeholder={t("supportFeedback.searchPlaceholder")}
                />
                {feedbackState?.filter ? <input name="filter" type="hidden" value={feedbackState.filter} /> : null}
              </form>
              <div className="flex flex-wrap gap-2">
                <Link
                  className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
                    filter === "all" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                  href={buildFilterUrl(null)}
                >
                  {t("supportFeedback.allFeedback")}
                </Link>
                <Link
                  className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
                    filter === "unread" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                  href={buildFilterUrl("unread")}
                >
                  {t("supportFeedback.unreadFeedback")}
                </Link>
              </div>
            </div>
          }
          resultSummary={t("supportFeedback.managementSummary", { shown: String(visibleFeedback.length), total: String(feedbackWithUnreadState.length) })}
          title={t("supportFeedback.title")}
        />
        <AdminCard>
          {visibleFeedback.length > 0 ? (
            <>
              <AdminTableShell
                cardsUntil="lg"
                label={t("supportFeedback.title")}
                mobileCards={
                <div className="grid gap-3">
                  {paginatedFeedback.map((item) => (
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
                  {paginatedFeedback.map((item) => (
                    <SupportFeedbackTableRow
                      key={item.id}
                      contact={item.contact}
                      createdAt={formatDateTimeWithSeconds(item.created_at, locale)}
                      email={item.email}
                      feedbackId={item.id}
                      initialStatus={item.status as FeedbackStatus}
                      isUnread={item.isUnread}
                      labels={tableRowLabels}
                      locale={locale}
                      message={item.message}
                      subject={item.subject}
                    />
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
            {totalPages > 1 && (
              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath={paginationBasePath}
                labels={{
                  previous: t("supportFeedback.previous"),
                  next: t("supportFeedback.next"),
                  page: t("supportFeedback.page"),
                  of: t("supportFeedback.of"),
                }}
              />
            )}
            </>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-600">{t("supportFeedback.empty")}</p>
          )}
        </AdminCard>
      </AdminDataWorkbench>
    </AdminShell>
  );
}
