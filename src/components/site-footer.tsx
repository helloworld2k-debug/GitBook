import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/routing";

const footerLinkClass =
  "inline-flex min-h-9 items-center text-sm text-slate-300 transition-colors hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export async function SiteFooter() {
  const footer = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const home = await getTranslations("home");
  const year = new Date().getFullYear();

  const columns = [
    {
      title: footer("product"),
      links: [
        { href: "/", label: nav("download") },
        { href: "/versions", label: home("olderVersions") },
        { href: "/contributions", label: nav("donate") },
      ],
    },
    {
      title: footer("account"),
      links: [
        { href: "/dashboard", label: nav("dashboard") },
        { href: "/notifications", label: nav("notifications") },
      ],
    },
    {
      title: footer("resources"),
      links: [{ href: "/support", label: nav("support") }],
    },
  ];

  return (
    <footer className="border-t border-cyan-300/10 bg-slate-950" role="contentinfo">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-3 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <span className="flex size-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
              AI
            </span>
            {siteConfig.name}
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">{footer("tagline")}</p>
          <p className="mt-4 text-xs text-slate-500">
            © {year} {siteConfig.name}. {footer("copyright")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-white">{column.title}</h2>
              <div className="mt-3 flex flex-col gap-1">
                {column.links.map((link) => (
                  <Link className={footerLinkClass} href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
