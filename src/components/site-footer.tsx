import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/routing";

export async function SiteFooter() {
  const footer = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-cyan-300/10 bg-slate-950" role="contentinfo">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-slate-400">
          © {year} {siteConfig.name}. {footer("copyright")}
        </p>
        <nav aria-label={footer("policiesNav")} className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-300">
          <Link className="hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200" href="/help">
            {footer("help")}
          </Link>
          <Link className="hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200" href="/policies/terms">
            {footer("terms")}
          </Link>
          <Link className="hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200" href="/policies/privacy">
            {footer("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
