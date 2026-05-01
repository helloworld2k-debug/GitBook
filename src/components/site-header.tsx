import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { siteConfig, supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    <header className="border-b border-cyan-300/10 bg-slate-950/90 backdrop-blur-xl">
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
          <Link href="/dashboard" className={navLinkClass}>
            {t("dashboard")}
          </Link>
          {userLabel ? (
            <Link href="/dashboard" className={navLinkClass}>
              {userLabel}
            </Link>
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
