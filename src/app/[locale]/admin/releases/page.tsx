import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCard, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { supportedLocales, type Locale } from "@/config/site";
import { getAdminShellProps } from "@/lib/admin/shell";
import { SOFTWARE_RELEASES_BUCKET, type ReleaseClient, type SoftwareRelease } from "@/lib/releases/software-releases";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createSoftwareRelease, setSoftwareReleasePublished } from "../actions";

type AdminReleasesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

type AdminReleaseRow = SoftwareRelease & {
  isPublished: boolean;
};

function formatReleaseDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function AdminReleasesPage({ params }: AdminReleasesPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale as Locale, "/admin/releases");
  const createRelease = createSoftwareRelease;
  const togglePublished = setSoftwareReleasePublished;
  let releases: AdminReleaseRow[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("software_releases")
      .select("id,version,released_at,notes,is_published,software_release_assets(id,platform,file_name,storage_path,file_size)")
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
      isPublished: row.is_published,
      assets: (row.software_release_assets ?? []).map((asset) => ({
        id: asset.id,
        platform: asset.platform,
        fileName: asset.file_name,
        storagePath: asset.storage_path,
        fileSize: asset.file_size,
        downloadUrl: releaseClient.storage.from(SOFTWARE_RELEASES_BUCKET).getPublicUrl(asset.storage_path).data.publicUrl,
      })),
    }));
  } catch {
    releases = [];
  }

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
          <AdminCard className="p-5">
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">{t("releases.createTitle")}</h2>
            <form action={createRelease} className="mt-5 grid gap-4">
              <input name="locale" type="hidden" value={locale} />
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
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.macFile")}
                  <input className="mt-2 block w-full text-sm text-slate-700" name="macos_file" type="file" />
                </label>
                <label className="text-sm font-medium text-slate-950">
                  {t("releases.windowsFile")}
                  <input className="mt-2 block w-full text-sm text-slate-700" name="windows_file" type="file" />
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-950">
                <input className="size-4" name="is_published" type="checkbox" />
                {t("releases.published")}
              </label>
              <button className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white" type="submit">
                {t("releases.create")}
              </button>
            </form>
          </AdminCard>

          <AdminCard className="mt-6">
            {releases.length > 0 ? (
              <ul className="divide-y divide-slate-200">
                {releases.map((release) => (
                  <li className="px-5 py-4" key={release.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-lg font-semibold text-slate-950">{release.version}</h2>
                          <AdminStatusBadge tone={release.isPublished ? "success" : "neutral"}>
                            {release.isPublished ? t("releases.published") : t("releases.unpublish")}
                          </AdminStatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{formatReleaseDate(release.releasedAt, locale)}</p>
                        {release.notes ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{release.notes}</p> : null}
                        <p className="mt-3 text-sm font-medium text-slate-950">{t("releases.assets")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {release.assets.map((asset) => (
                            <a className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700" href={asset.downloadUrl} key={asset.id}>
                              {asset.platform}: {asset.fileName}
                            </a>
                          ))}
                        </div>
                      </div>
                      <form action={togglePublished}>
                        <input name="locale" type="hidden" value={locale} />
                        <input name="release_id" type="hidden" value={release.id} />
                        <input name="is_published" type="hidden" value={release.isPublished ? "false" : "true"} />
                        <button className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" type="submit">
                          {release.isPublished ? t("releases.unpublish") : t("releases.publish")}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-slate-600">{t("releases.empty")}</p>
            )}
          </AdminCard>
        </section>
    </AdminShell>
  );
}
