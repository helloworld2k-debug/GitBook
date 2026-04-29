import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { siteConfig, supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";

type LocalizedPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const downloadLinkClass =
  "flex min-h-11 items-center justify-center rounded-md px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950";

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

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t("subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                className={`${downloadLinkClass} bg-slate-950 text-white hover:bg-slate-800`}
                href={siteConfig.downloadLinks.macos}
              >
                {t("downloadMac")}
              </a>
              <a
                className={`${downloadLinkClass} border border-slate-300 bg-white text-slate-950 hover:bg-slate-100`}
                href={siteConfig.downloadLinks.windows}
              >
                {t("downloadWindows")}
              </a>
              <a
                className={`${downloadLinkClass} border border-slate-300 bg-white text-slate-950 hover:bg-slate-100`}
                href={siteConfig.downloadLinks.linux}
              >
                {t("downloadLinux")}
              </a>
            </div>
            <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              {t("supportPrompt")}{" "}
              <Link
                className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-950"
                href="/donate"
              >
                {nav("donate")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
