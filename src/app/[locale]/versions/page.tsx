import { getTranslations } from "next-intl/server";
import { supportedLocales } from "@/config/site";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { getCachedPublishedReleases } from "@/lib/releases/public-cache";
import { getPlatformDelivery, type SoftwareRelease } from "@/lib/releases/software-releases";

type VersionsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

function formatReleaseDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function VersionsPage({ params }: VersionsPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);
  const t = await getTranslations("versions");
  let releases: SoftwareRelease[] = [];

  try {
    releases = (await optionalTimeout(getCachedPublishedReleases())) ?? [];
  } catch {
    releases = [];
  }

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-3xl">
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-normal text-white sm:text-5xl">{t("title")}</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">{t("subtitle")}</p>
          </div>

          {releases.length > 0 ? (
            <div className="mt-10 space-y-4">
              {releases.map((release) => {
                const macDelivery = getPlatformDelivery(release, "macos");
                const windowsDelivery = getPlatformDelivery(release, "windows");

                return (
                  <article className="glass-panel rounded-lg p-5" key={release.id}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold text-white">{release.version}</h2>
                        <p className="mt-1 text-sm text-slate-400">{formatReleaseDate(release.releasedAt, locale)}</p>
                        {release.notes ? <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{release.notes}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {macDelivery?.primaryUrl ? <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/50" href={macDelivery.primaryUrl}>{t("downloadMac")} {t("releases.primaryLink")}</a> : null}
                        {macDelivery?.backupUrl ? <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-slate-900/50 px-4 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/50" href={macDelivery.backupUrl}>{t("downloadMac")} {t("releases.backupLink")}</a> : null}
                        {windowsDelivery?.primaryUrl ? <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-violet-300/20 bg-violet-300/10 px-4 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/50" href={windowsDelivery.primaryUrl}>{t("downloadWindows")} {t("releases.primaryLink")}</a> : null}
                        {windowsDelivery?.backupUrl ? <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-violet-300/20 bg-slate-900/50 px-4 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/50" href={windowsDelivery.backupUrl}>{t("downloadWindows")} {t("releases.backupLink")}</a> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-10 rounded-md border border-cyan-300/15 bg-white/[0.05] p-5 text-sm text-slate-300">{t("empty")}</p>
          )}
        </section>
      </main>
    </>
  );
}
