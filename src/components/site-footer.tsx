import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";

export async function SiteFooter() {
  const footer = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-cyan-300/10 bg-slate-950" role="contentinfo">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex min-h-11 items-center gap-3 text-base font-semibold text-white">
          <span className="flex size-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
            AI
          </span>
          {siteConfig.name}
        </div>

        <p className="text-sm leading-6 text-slate-400 md:text-right">
          © {year} {siteConfig.name}. {footer("copyright")}
        </p>
      </div>
    </footer>
  );
}
