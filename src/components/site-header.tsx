import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Bell, Gift, Headset, House, Newspaper } from "lucide-react";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { siteConfig, supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";

const navLinkClass =
  "flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export async function SiteHeader({ showAccountMenu = true }: { showAccountMenu?: boolean } = {}) {
  const t = await getTranslations("nav");
  const localeValue = await getLocale();
  const currentLocale = supportedLocales.includes(localeValue as Locale) ? (localeValue as Locale) : "en";
  const userMenuLabels = {
    accountMenu: t("accountMenu"),
    dashboard: t("dashboard"),
    signIn: t("signIn"),
    signOut: t("signOut"),
    userMenu: t("userMenu"),
  };

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-300/10 bg-slate-950/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <span className="flex size-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
            AI
          </span>
          {siteConfig.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/" className={navLinkClass}>
            <House aria-hidden="true" className="mr-1 size-4" />
            {t("download")}
          </Link>
          <Link href="/contributions" className={navLinkClass}>
            <Gift aria-hidden="true" className="mr-1 size-4" />
            {t("donate")}
          </Link>
          <Link href="/support" className={navLinkClass}>
            <Headset aria-hidden="true" className="mr-1 size-4" />
            {t("support")}
          </Link>
          <Link href="/news" className={navLinkClass}>
            <Newspaper aria-hidden="true" className="mr-1 size-4" />
            {t("news")}
          </Link>
          <Link href="/notifications" className={navLinkClass}>
            <Bell aria-hidden="true" className="mr-1 size-4" />
            {t("notifications")}
          </Link>
          {showAccountMenu ? (
            <Suspense
              fallback={
                <div
                  aria-hidden="true"
                  className="min-h-11 w-20 rounded-md border border-cyan-300/15 bg-cyan-300/10"
                />
              }
            >
              <HeaderUserMenu currentLocale={currentLocale} labels={userMenuLabels} />
            </Suspense>
          ) : (
            <Link href="/login" className={navLinkClass}>
              {t("signIn")}
            </Link>
          )}
          <Suspense fallback={<div className="min-h-11 min-w-20 rounded-md border border-cyan-300/15 bg-white/[0.05]" aria-hidden="true" />}>
            <LanguageSwitcher currentLocale={currentLocale} label={t("language")} />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
