import { getTranslations } from "next-intl/server";
import { AdminFeedbackBanner, AdminCard, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { isOwnerProfile } from "@/lib/auth/guards";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { bulkRestoreArchivedUsers, permanentlyDeleteArchivedUser, restoreArchivedUser } from "@/app/[locale]/admin/users/actions";

type AdminArchivedUsersSearchParams = {
  error?: string;
  notice?: string;
  page?: string;
  query?: string;
};

type AdminArchivedUsersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminArchivedUsersSearchParams>;
};

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchesSearch(archive: { display_name: string | null; email: string | null }, query?: string) {
  const normalized = String(query ?? "").trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [archive.email ?? "", archive.display_name ?? ""].some((value) => value.toLowerCase().includes(normalized));
}

export default async function AdminArchivedUsersPage({ params, searchParams }: AdminArchivedUsersPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale, user: admin } = await setupAdminPage(localeParam, `/${localeParam}/admin/archived-users`);
  const t = await getTranslations("admin.archivedUsers");
  const adminT = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/archived-users");
  const canPermanentlyDelete = isOwnerProfile({ admin_role: admin.admin_role, is_admin: admin.is_admin });

  const supabase = await import("@/lib/supabase/admin").then((m) => m.createSupabaseAdminClient()) as any;

  const { data: archivedUsers, error } = await supabase
    .from("deleted_users_archive")
    .select("*")
    .order("deleted_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const filteredArchivedUsers = (archivedUsers ?? []).filter((archive) => matchesSearch(archive, feedback?.query));

  // Client-side pagination
  const PAGE_SIZE = 20;
  const currentPage = Number(feedback?.page ?? 1);
  const totalPages = Math.max(1, Math.ceil(filteredArchivedUsers.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedArchivedUsers = filteredArchivedUsers.slice(startIndex, endIndex);

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin/users"
          backLabel={adminT("users.title")}
          description={adminT("archivedUsers.description")}
          eyebrow={t("eyebrow")}
          title={t("title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <AdminCard className="mt-6">
          {paginatedArchivedUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-base font-medium text-slate-950">{t("empty")}</p>
            </div>
          ) : (
            <>
              <AdminTableShell
                label={t("title")}
                mobileCards={
                  <div className="grid gap-3">
                    {paginatedArchivedUsers.map((archive) => (
                      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={archive.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-all text-sm font-semibold text-slate-950">{archive.email}</p>
                            <p className="mt-1 text-sm text-slate-600">{archive.display_name ?? "-"}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t("deletedAt")}: {formatDate(archive.deleted_at, locale)}
                            </p>
                          </div>
                          <AdminStatusBadge tone="warning">{t("archived")}</AdminStatusBadge>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500">{t("originalStatus")}</dt>
                            <dd className="font-medium text-slate-900">{archive.account_status ?? "active"}</dd>
                          </div>
                          {archive.deleted_reason ? (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-slate-500">{t("reason")}</dt>
                              <dd className="text-right text-slate-900">{archive.deleted_reason}</dd>
                            </div>
                          ) : null}
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={restoreArchivedUser} className="flex-1">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="return_to" type="hidden" value="/admin/archived-users" />
                            <input name="archive_id" type="hidden" value={archive.id} />
                            <ConfirmActionButton
                              className="inline-flex w-full min-h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                              confirmLabel={t("restoreConfirm")}
                              pendingLabel={adminT("common.processing")}
                            >
                              {t("restore")}
                            </ConfirmActionButton>
                          </form>
                          {canPermanentlyDelete ? (
                            <form action={permanentlyDeleteArchivedUser} className="flex-1">
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/archived-users" />
                              <input name="archive_id" type="hidden" value={archive.id} />
                              <ConfirmActionButton
                                className="inline-flex w-full min-h-10 items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                                confirmLabel={t("permanentDeleteConfirm")}
                                pendingLabel={adminT("common.processing")}
                              >
                                {t("permanentDelete")}
                              </ConfirmActionButton>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                }
              >
                <table aria-label={t("title")} className="min-w-[1200px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[280px]" />
                    <col className="w-[200px]" />
                    <col className="w-[150px]" />
                    <col className="w-[180px]" />
                    <col className="w-[200px]" />
                    <col className="w-[300px]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">{t("user")}</th>
                      <th className="px-5 py-3">{t("originalStatus")}</th>
                      <th className="px-5 py-3">{t("deletedAt")}</th>
                      <th className="px-5 py-3">{t("reason")}</th>
                      <th className="px-5 py-3">{t("deletedBy")}</th>
                      <th className="sticky right-0 z-10 w-[300px] border-l border-slate-200 bg-slate-50 px-5 py-3 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedArchivedUsers.map((archive) => (
                      <tr key={archive.id}>
                        <td className="px-5 py-4 align-top">
                          <p className="break-all font-medium text-slate-950">{archive.email}</p>
                          <p className="mt-1 text-slate-600">{archive.display_name ?? "-"}</p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-500">{archive.original_user_id}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <AdminStatusBadge tone="neutral">{archive.account_status ?? "active"}</AdminStatusBadge>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-700">{formatDate(archive.deleted_at, locale)}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-700">{archive.deleted_reason ?? "-"}</td>
                        <td className="px-5 py-4 align-top text-sm text-slate-700">{archive.deleted_by ?? "-"}</td>
                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 align-top shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          <div className="flex min-w-[260px] flex-wrap justify-end gap-2">
                            <form action={restoreArchivedUser}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/archived-users" />
                              <input name="archive_id" type="hidden" value={archive.id} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                                confirmLabel={t("restoreConfirm")}
                                pendingLabel={adminT("common.processing")}
                              >
                                {t("restore")}
                              </ConfirmActionButton>
                            </form>
                            {canPermanentlyDelete ? (
                              <form action={permanentlyDeleteArchivedUser}>
                                <input name="locale" type="hidden" value={locale} />
                                <input name="return_to" type="hidden" value="/admin/archived-users" />
                                <input name="archive_id" type="hidden" value={archive.id} />
                                <ConfirmActionButton
                                  className="inline-flex min-h-10 items-center rounded-md border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                                  confirmLabel={t("permanentDeleteConfirm")}
                                  pendingLabel={adminT("common.processing")}
                                >
                                  {t("permanentDelete")}
                                </ConfirmActionButton>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
              <AdminPagination
                basePath="/admin/archived-users"
                currentPage={currentPage}
                totalPages={totalPages}
                labels={{
                  previous: adminT("pagination.previous"),
                  next: adminT("pagination.next"),
                  page: adminT("pagination.page"),
                  of: adminT("pagination.of"),
                }}
              />
            </>
          )}
        </AdminCard>
      </section>
    </AdminShell>
  );
}
