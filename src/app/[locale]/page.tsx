import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { siteConfig, supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { getCachedLatestPublishedRelease } from "@/lib/releases/public-cache";
import { getPlatformDelivery, type ReleasePlatform, type SoftwareRelease } from "@/lib/releases/software-releases";

type LocalizedPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const downloadLinkClass =
  "flex min-h-12 items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

const featureKeys = ["One", "Two", "Three"] as const;

function formatReleaseDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getFallbackDownload(platform: ReleasePlatform) {
  return platform === "macos" ? siteConfig.downloadLinks.macos : siteConfig.downloadLinks.windows;
}

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocalizedHome({ params }: LocalizedPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");
  let latestRelease: SoftwareRelease | null = null;

  try {
    latestRelease = await optionalTimeout(getCachedLatestPublishedRelease());
  } catch {
    latestRelease = null;
  }

  const macDelivery = getPlatformDelivery(latestRelease, "macos");
  const windowsDelivery = getPlatformDelivery(latestRelease, "windows");
  const latestVersionLabel = latestRelease
    ? t("latestVersion", {
        version: latestRelease.version,
        date: formatReleaseDate(latestRelease.releasedAt, locale),
      })
    : t("latestVersionPending");
  const downloads = [
    {
      label: t("downloadMac"),
      href: macDelivery?.primaryUrl ?? getFallbackDownload("macos"),
      backupHref: macDelivery?.backupUrl ?? null,
      backupLabel: "macOS Backup",
      unavailable: latestRelease ? !macDelivery?.primaryUrl : false,
      className: `${downloadLinkClass} neon-button text-white`,
    },
    {
      label: t("downloadWindows"),
      href: windowsDelivery?.primaryUrl ?? getFallbackDownload("windows"),
      backupHref: windowsDelivery?.backupUrl ?? null,
      backupLabel: "Windows Backup",
      unavailable: latestRelease ? !windowsDelivery?.primaryUrl : false,
      className: `${downloadLinkClass} border border-cyan-300/20 bg-white/[0.08] text-cyan-100 hover:border-cyan-300/50 hover:bg-white/[0.12]`,
    },
  ];

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <div aria-label="Animated code intelligence background" className="code-field" role="img">
          <div className="code-stream code-stream-one">
            {["const ai = index(book);", "await mapConcepts(code);", "reader.sync(notes);", "model.ready();"].map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="code-stream code-stream-two">
            {["export knowledgeGraph", "tokenize(chapters)", "build release notes", "download.bundle.ok"].map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="code-stream code-stream-three">
            {["{ status: 'online' }", "vector.search('/docs')", "hydrate examples", "ship desktop app"].map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <section className="mx-auto grid min-h-[calc(100dvh-77px)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-20">
          <div>
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-normal text-white sm:text-6xl lg:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{t("subtitle")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {downloads.map((download) =>
                download.unavailable ? (
                  <span
                    aria-disabled="true"
                    className={`${download.className} cursor-not-allowed opacity-50`}
                    key={download.label}
                  >
                    {download.label}
                  </span>
                ) : (
                  <div className="flex flex-col gap-2" key={download.label}>
                    <a className={download.className} href={download.href}>
                      {download.label}
                    </a>
                    {download.backupHref ? (
                      <a className={`${downloadLinkClass} border border-slate-700 bg-slate-900/40 text-slate-200 hover:border-slate-500`} href={download.backupHref}>
                        {download.backupLabel}
                      </a>
                    ) : null}
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>{latestVersionLabel}</span>
              <Link
                className="font-semibold text-cyan-100 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                href="/versions"
              >
                {t("olderVersions")}
              </Link>
            </div>
            <div className="mt-9 max-w-2xl rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100">
              {t("supportPrompt")}{" "}
              <Link
                className="font-semibold text-cyan-100 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                href="/contributions"
              >
                {nav("donate")}
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-lg p-5">
            <div className="flex items-center justify-between border-b border-cyan-300/10 pb-4">
              <div>
                <p className="font-mono text-sm text-cyan-200">{t("mockTitle")}</p>
                <p className="mt-1 text-xs uppercase text-slate-500">gitbook.ai/runtime</p>
              </div>
              <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {t("mockStatus")}
              </span>
            </div>
            <div className="mt-5 space-y-3 font-mono text-sm">
              {[t("mockLineOne"), t("mockLineTwo"), t("mockLineThree")].map((line, index) => (
                <div className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-3" key={line}>
                  <span className="text-cyan-300">0{index + 1}</span>
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.7)]" />
                  <span className="text-slate-200">{line}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["NLP", "Code", "Docs"].map((label) => (
                <div className="rounded-md border border-violet-300/20 bg-violet-300/10 px-3 py-4 text-center text-xs font-semibold text-violet-100" key={label}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3">
          {featureKeys.map((key) => (
            <article className="glass-panel rounded-lg p-5" key={key}>
              <h2 className="text-lg font-semibold text-white">{t(`feature${key}Title`)}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{t(`feature${key}Text`)}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
