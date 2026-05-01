import { getLocale, getTranslations } from "next-intl/server";
import { Bell, ChevronDown, Headset, LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { siteConfig, supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/[locale]/dashboard/actions";

const navLinkClass =
  "flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const localeValue = await getLocale();
  const currentLocale = supportedLocales.includes(localeValue as Locale) ? (localeValue as Locale) : "en";
  let userLabel: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const authResult = await optionalTimeout(supabase.auth.getUser(), 900);
    const user = authResult?.data.user;

    if (user) {
      const profileResult = await optionalTimeout(Promise.resolve(supabase.from("profiles").select("display_name,email").eq("id", user.id).single()), 900);
      const profile = profileResult?.data;
      userLabel = profile?.display_name || profile?.email || user.email || null;
    }
  } catch {
    userLabel = null;
  }

  return (
    <header className="relative z-50 border-b border-cyan-300/10 bg-slate-950/90 backdrop-blur-xl">
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
            {t("download")}
          </Link>
          <Link href="/donate" className={navLinkClass}>
            {t("donate")}
          </Link>
          <Link href="/support" className={navLinkClass}>
            <Headset aria-hidden="true" className="mr-1 size-4" />
            {t("support")}
          </Link>
          <Link href="/notifications" className={navLinkClass}>
            <Bell aria-hidden="true" className="mr-1 size-4" />
            {t("notifications")}
          </Link>
          {userLabel ? (
            <details className="group relative max-w-full">
              <summary
                aria-label={t("userMenu")}
                className="flex min-h-11 max-w-full cursor-pointer list-none items-center gap-2 rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300/30 hover:text-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:max-w-60 [&::-webkit-details-marker]:hidden"
              >
                <UserCircle aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{userLabel}</span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-12 z-[100] w-64 rounded-md border border-cyan-300/20 bg-slate-950/95 p-2 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
                <div className="border-b border-cyan-300/10 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">{userLabel}</p>
                  <p className="mt-1 text-xs text-slate-400">{t("accountMenu")}</p>
                </div>
                <Link
                  href="/dashboard"
                  className="mt-2 flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-100 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  <LayoutDashboard aria-hidden="true" className="size-4" />
                  {t("dashboard")}
                </Link>
                <form action={signOutAction.bind(null, currentLocale)}>
                  <button
                    className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-red-200 transition-colors hover:bg-red-400/10 hover:text-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                    type="submit"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {t("signOut")}
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link href="/login" className={navLinkClass}>
              {t("signIn")}
            </Link>
          )}
          <LanguageSwitcher currentLocale={currentLocale} label={t("language")} />
        </div>
      </nav>
    </header>
  );
}
