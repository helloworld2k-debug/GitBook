import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";

export async function SiteFooter() {
  const footer = await getTranslations("footer");
  const year = new Date().getFullYear();
  const notes = [footer("status"), footer("availability"), footer("contact")];

  return (
    <footer className="border-t border-cyan-300/10 bg-slate-950" role="contentinfo">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
        <div className="max-w-xl">
          <div className="inline-flex min-h-11 items-center gap-3 text-base font-semibold text-white">
            <span className="flex size-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
              AI
            </span>
            {siteConfig.name}
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">{footer("tagline")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {notes.map((note) => (
            <p className="rounded-md border border-cyan-300/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-slate-300" key={note}>
              {note}
            </p>
          ))}
        </div>

        <p className="text-xs text-slate-500 lg:col-span-2">
          © {year} {siteConfig.name}. {footer("copyright")}
        </p>
      </div>
    </footer>
  );
}
