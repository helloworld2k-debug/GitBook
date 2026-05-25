import { getTranslations } from "next-intl/server";
import { AdminReleaseSelectAllCheckbox } from "@/components/admin/admin-release-bulk-controls";
import { AdminReleaseDeliveryModeFields } from "@/components/admin/admin-release-delivery-mode-fields";
import { AdminReleaseMissingAssetUpload } from "@/components/admin/admin-release-missing-asset-upload";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { RELEASE_PLATFORMS, SOFTWARE_RELEASES_BUCKET, getPlatformDelivery, type ReleaseClient, type ReleaseDeliveryMode, type ReleasePlatform, type ReleaseStatus, type SoftwareRelease } from "@/lib/releases/software-releases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bulkUpdateSoftwareReleases, createSoftwareRelease, deleteDraftSoftwareRelease, setSoftwareReleasePublished } from "../actions";

type AdminReleasesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{ error?: string; notice?: string; platforms?: string; query?: string; status?: string }>;
};

type AdminReleaseRow = SoftwareRelease & {
  isPublished: boolean;
};

function getStatusTone(status: SoftwareRelease["releaseStatus"]) {
  if (status === "ready") return "success";
  if (status === "failed") return "danger";
  if (status === "uploading") return "warning";
  return "neutral";
}

function formatReleaseDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getPlatformShortLabel(platform: ReleasePlatform) {
  if (platform === "macos_arm64") return "M";
  if (platform === "macos_x64") return "Intel";
  return "Win";
}

function formatTemplate(template: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)),
    template,
  );
}

function hasPlatformDelivery(release: AdminReleaseRow, platform: ReleasePlatform) {
  return Boolean(getPlatformDelivery(release, platform)?.primaryUrl);
}

function hasCompletePlatformSet(release: AdminReleaseRow) {
  return RELEASE_PLATFORMS.every((platform) => hasPlatformDelivery(release, platform));
}

export default async function AdminReleasesPage({ params, searchParams }: AdminReleasesPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/releases`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/releases");
  const createRelease = createSoftwareRelease;
  const togglePublished = setSoftwareReleasePublished;
  const deleteDraft = deleteDraftSoftwareRelease;
  const bulkUpdateReleases = bulkUpdateSoftwareReleases;
  let releases: AdminReleaseRow[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("software_releases")
      .select("id,version,released_at,notes,delivery_mode,macos_arm64_primary_url,macos_arm64_backup_url,macos_x64_primary_url,macos_x64_backup_url,macos_primary_url,macos_backup_url,windows_primary_url,windows_backup_url,is_published,release_status,software_release_assets(id,platform,file_name,storage_path,file_size)")
      .order("released_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const releaseClient = supabase as unknown as ReleaseClient;
    releases = (data ?? []).map((row) => ({
      id: row.id,
      version: row.version,
      releasedAt: row.released_at,
      notes: row.notes,
      deliveryMode: row.delivery_mode as ReleaseDeliveryMode,
      macosArm64PrimaryUrl: row.macos_arm64_primary_url,
      macosArm64BackupUrl: row.macos_arm64_backup_url,
      macosX64PrimaryUrl: row.macos_x64_primary_url,
      macosX64BackupUrl: row.macos_x64_backup_url,
      macosPrimaryUrl: row.macos_primary_url,
      macosBackupUrl: row.macos_backup_url,
      windowsPrimaryUrl: row.windows_primary_url,
      windowsBackupUrl: row.windows_backup_url,
      isPublished: row.is_published,
      releaseStatus: (row.release_status ?? "ready") as ReleaseStatus,
      assets: (row.software_release_assets ?? []).map((asset) => ({
        id: asset.id,
        platform: asset.platform as ReleasePlatform,
        fileName: asset.file_name,
        storagePath: asset.storage_path,
        fileSize: asset.file_size,
        downloadUrl: releaseClient.storage.from(SOFTWARE_RELEASES_BUCKET).getPublicUrl(asset.storage_path).data.publicUrl,
      })),
    }));
  } catch {
    releases = [];
  }

  const query = String(feedback?.query ?? "").trim().toLowerCase();
  const statusFilter = String(feedback?.status ?? "");
  const platformFilter = String(feedback?.platforms ?? "");
  const visibleReleases = releases.filter((release) => {
    const matchesQuery = query.length === 0
      || release.version.toLowerCase().includes(query)
      || (release.notes ?? "").toLowerCase().includes(query);
    const matchesStatus = !statusFilter || release.releaseStatus === statusFilter;
    const isComplete = hasCompletePlatformSet(release);
    const matchesPlatforms = !platformFilter
      || (platformFilter === "complete" && isComplete)
      || (platformFilter === "missing" && !isComplete);

    return matchesQuery && matchesStatus && matchesPlatforms;
  });
  const bulkFormId = "release-bulk-action-form";

  return (
    <AdminShell {...shellProps}>
        <section className="mx-auto max-w-7xl">
          <AdminPageHeader
            backHref="/admin"
            backLabel={t("shell.backToAdmin")}
            description={t("releases.description")}
            eyebrow={t("releases.eyebrow")}
            title={t("releases.title")}
          />
          <AdminFeedbackBanner error={feedback?.error} getMessage={(key) => t(key)} notice={feedback?.notice} />
          <AdminCard className="p-5">
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("releases.createTitle")}</h2>
            <form action={createRelease} className="mt-5 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <input name="return_to" type="hidden" value="/admin/releases" />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.version")}
                  <input
                    className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
                    name="version"
                    placeholder="v1.2.0"
                    required
                  />
                </label>
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.releasedAt")}
                  <input className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm" name="released_at" required type="date" />
                </label>
              </div>
              <label className="text-sm font-medium text-slate-950">
                {t("releases.notes")}
                <textarea className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="notes" />
              </label>
              <AdminReleaseDeliveryModeFields
                labels={{
                  deliveryMode: t("releases.deliveryMode"),
                  deliveryModeFile: t("releases.deliveryModeFile"),
                  deliveryModeFileHelp: t("releases.deliveryModeFileHelp"),
                  deliveryModeLink: t("releases.deliveryModeLink"),
                  deliveryModeLinkHelp: t("releases.deliveryModeLinkHelp"),
                  create: t("releases.create"),
                  createLink: t("releases.createLinkRelease"),
                  macAppleSiliconBackupUrl: t("releases.macAppleSiliconBackupUrl"),
                  macAppleSiliconFile: t("releases.macAppleSiliconFile"),
                  macAppleSiliconPrimaryUrl: t("releases.macAppleSiliconPrimaryUrl"),
                  macIntelBackupUrl: t("releases.macIntelBackupUrl"),
                  macIntelFile: t("releases.macIntelFile"),
                  macIntelPrimaryUrl: t("releases.macIntelPrimaryUrl"),
                  maxFileSizeHelp: t("releases.maxFileSizeHelp"),
                  pauseUpload: t("releases.pauseUpload"),
                  publishMode: t("releases.publishMode"),
                  publishModeDraft: t("releases.publishModeDraft"),
                  publishModePublish: t("releases.publishModePublish"),
                  retryUpload: t("releases.retryUpload"),
                  resumeUpload: t("releases.resumeUpload"),
                  uploadAndPublish: t("releases.uploadAndPublish"),
                  uploadAndSaveDraft: t("releases.uploadAndSaveDraft"),
                  uploadComplete: t("releases.uploadComplete"),
                  uploadFailed: t("releases.uploadFailed"),
                  uploadIdle: t("releases.uploadIdle"),
                  uploadLimitError: t("releases.uploadLimitError"),
                  uploadProgress: t("releases.uploadProgress"),
                  uploadStepComplete: t("releases.uploadStepComplete"),
                  uploadStepFinalizing: t("releases.uploadStepFinalizing"),
                  uploadStepPreparing: t("releases.uploadStepPreparing"),
                  uploadStepUploading: t("releases.uploadStepUploading"),
                  uploadSummary: t("releases.uploadSummary"),
                  uploadUploading: t("releases.uploadUploading"),
                  windowsBackupUrl: t("releases.windowsBackupUrl"),
                  windowsFile: t("releases.windowsFile"),
                  windowsPrimaryUrl: t("releases.windowsPrimaryUrl"),
                }}
                locale={locale}
              />
            </form>
          </AdminCard>

          <AdminCard className="mt-6 p-0">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("releases.historyTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-600">{t("releases.description")}</p>
                </div>
                <form action={bulkUpdateReleases} className="flex flex-wrap items-end gap-3" id={bulkFormId}>
                  <input name="locale" type="hidden" value={locale} />
                  <input name="return_to" type="hidden" value="/admin/releases" />
                  <label className="text-sm font-medium text-slate-950">
                    {t("releases.bulkAction")}
                    <select className="mt-2 min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" name="bulk_action">
                      <option value="publish">{t("releases.bulkPublish")}</option>
                      <option value="unpublish">{t("releases.bulkUnpublish")}</option>
                      <option value="delete_drafts">{t("releases.bulkDeleteDrafts")}</option>
                    </select>
                  </label>
                  <ConfirmActionButton
                    className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
                    confirmLabel={t("releases.bulkConfirm")}
                    pendingLabel={t("common.processing")}
                  >
                    {t("releases.applyBulkAction")}
                  </ConfirmActionButton>
                </form>
              </div>
              <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.search")}
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    defaultValue={feedback?.query ?? ""}
                    name="query"
                    placeholder={t("releases.searchPlaceholder")}
                  />
                </label>
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.statusFilter")}
                  <select className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={statusFilter} name="status">
                    <option value="">{t("releases.allStatuses")}</option>
                    {(["draft", "uploading", "ready", "failed"] as const).map((status) => (
                      <option key={status} value={status}>{t(`releases.statuses.${status}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.platformFilter")}
                  <select className="mt-2 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={platformFilter} name="platforms">
                    <option value="">{t("releases.allPlatforms")}</option>
                    <option value="complete">{t("releases.completePlatforms")}</option>
                    <option value="missing">{t("releases.missingPlatforms")}</option>
                  </select>
                </label>
                <button className="inline-flex min-h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">
                  {t("releases.applyFilters")}
                </button>
              </form>
            </div>
            {visibleReleases.length > 0 ? (
              <AdminTableShell
                label={t("releases.historyTableLabel")}
                mobileCards={
                  <div className="grid gap-3">
                    {visibleReleases.map((release) => (
                      <article className="rounded-md border border-slate-200 bg-white p-4" key={release.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-950">{release.version}</h3>
                            <p className="mt-1 text-sm text-slate-600">{formatReleaseDate(release.releasedAt, locale)}</p>
                          </div>
                          <AdminStatusBadge tone={release.isPublished ? "success" : "neutral"}>
                            {release.isPublished ? t("releases.published") : t("releases.unpublish")}
                          </AdminStatusBadge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {RELEASE_PLATFORMS.map((platform) => (
                            <AdminStatusBadge tone={hasPlatformDelivery(release, platform) ? "success" : "warning"} key={platform}>
                              {formatTemplate(hasPlatformDelivery(release, platform) ? t("releases.platformReady") : t("releases.platformPending"), {
                                platform: getPlatformShortLabel(platform),
                              })}
                            </AdminStatusBadge>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                }
              >
                <table aria-label={t("releases.historyTableLabel")} className="min-w-[1060px] w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
                    <tr>
                      <th className="px-5 py-3">
                        <AdminReleaseSelectAllCheckbox formId={bulkFormId} label={t("releases.selectAllReleases")} />
                      </th>
                      <th className="px-5 py-3">{t("releases.versionColumn")}</th>
                      <th className="px-5 py-3">{t("releases.dateColumn")}</th>
                      <th className="px-5 py-3">{t("releases.statusColumn")}</th>
                      <th className="px-5 py-3">{t("releases.modeColumn")}</th>
                      <th className="px-5 py-3">{t("releases.platformsColumn")}</th>
                      <th className="sticky right-0 z-10 border-l border-slate-200 bg-slate-50 px-5 py-3">{t("releases.actionsColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {visibleReleases.map((release) => (
                      <tr className="align-top" key={release.id}>
                        <td className="px-5 py-4">
                          <input
                            aria-label={formatTemplate(t("releases.selectRelease"), { version: release.version })}
                            className="size-4 rounded border-slate-300"
                            form={bulkFormId}
                            name="release_ids"
                            type="checkbox"
                            value={release.id}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-950">{release.version}</p>
                          {release.notes ? <p className="mt-1 max-w-72 line-clamp-2 text-slate-600">{release.notes}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatReleaseDate(release.releasedAt, locale)}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <AdminStatusBadge tone={release.isPublished ? "success" : "neutral"}>
                              {release.isPublished ? t("releases.published") : t("releases.unpublish")}
                            </AdminStatusBadge>
                            <AdminStatusBadge tone={getStatusTone(release.releaseStatus)}>
                              {t(`releases.statuses.${release.releaseStatus}`)}
                            </AdminStatusBadge>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge tone={release.deliveryMode === "link" ? "warning" : "neutral"}>
                            {release.deliveryMode === "link" ? t("releases.modeLink") : t("releases.modeFile")}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="grid min-w-80 gap-2">
                            {RELEASE_PLATFORMS.map((platform) => {
                              const delivery = getPlatformDelivery(release, platform);
                              const asset = release.assets.find((entry) => entry.platform === platform || (platform === "macos_arm64" && entry.platform === "macos"));
                              const platformReady = Boolean(delivery?.primaryUrl);
                              return (
                                <div className="flex flex-wrap items-center gap-2" key={platform}>
                                  <AdminStatusBadge tone={platformReady ? "success" : "warning"}>
                                    {formatTemplate(platformReady ? t("releases.platformReady") : t("releases.platformPending"), {
                                      platform: getPlatformShortLabel(platform),
                                    })}
                                  </AdminStatusBadge>
                                  {delivery?.source === "link" ? (
                                    <>
                                      {delivery.primaryUrl ? <a className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline" href={delivery.primaryUrl}>{t("releases.primaryLink")}</a> : null}
                                      {delivery.backupUrl ? <a className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline" href={delivery.backupUrl}>{t("releases.backupLink")}</a> : null}
                                    </>
                                  ) : asset ? (
                                    <a className="max-w-64 truncate text-sm font-medium text-slate-700 underline-offset-4 hover:underline" href={asset.downloadUrl}>
                                      {asset.fileName}
                                    </a>
                                  ) : (
                                    <AdminReleaseMissingAssetUpload
                                      labels={{
                                        addInstaller: t("releases.addInstaller"),
                                        comingSoon: t("releases.comingSoon"),
                                        uploadComplete: t("releases.uploadComplete"),
                                        uploadFailed: t("releases.uploadFailed"),
                                        uploadLimitError: t("releases.uploadLimitError"),
                                        uploadUploading: t("releases.uploadUploading"),
                                      }}
                                      locale={locale}
                                      platform={platform}
                                      releaseId={release.id}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-5 py-4 shadow-[-8px_0_16px_rgba(15,23,42,0.04)]">
                          {release.releaseStatus === "ready" ? (
                            <form action={togglePublished}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/releases" />
                              <input name="release_id" type="hidden" value={release.id} />
                              <input name="is_published" type="hidden" value={release.isPublished ? "false" : "true"} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
                                confirmLabel={release.isPublished ? t("releases.unpublish") : t("releases.publish")}
                                pendingLabel={t("common.processing")}
                              >
                                {release.isPublished ? t("releases.unpublish") : t("releases.publish")}
                              </ConfirmActionButton>
                            </form>
                          ) : (
                            <form action={deleteDraft}>
                              <input name="locale" type="hidden" value={locale} />
                              <input name="return_to" type="hidden" value="/admin/releases" />
                              <input name="release_id" type="hidden" value={release.id} />
                              <ConfirmActionButton
                                className="inline-flex min-h-10 items-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700"
                                confirmLabel={t("releases.deleteDraft")}
                                pendingLabel={t("common.processing")}
                              >
                                {t("releases.deleteDraft")}
                              </ConfirmActionButton>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <p className="p-5 text-sm text-slate-600">{t("releases.empty")}</p>
            )}
          </AdminCard>
        </section>
    </AdminShell>
  );
}
