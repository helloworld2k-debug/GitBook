import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

const navLinkClass =
  "flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          className="flex min-h-11 items-center text-base font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Three Friends
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
          <Link href="/login" className={navLinkClass}>
            {t("signIn")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
