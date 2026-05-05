"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { supportedLocales, type Locale } from "@/config/site";

const languageLabels: Record<Locale, { short: string; label: string }> = {
  en: { short: "EN", label: "English" },
  "zh-Hant": { short: "ZH", label: "中文" },
  ja: { short: "JP", label: "日本語" },
  ko: { short: "KR", label: "한국어" },
};

function LanguageBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded-md border border-current/15 bg-current/5 px-2 py-1 text-[11px] font-bold tracking-[0.12em]">
      {text}
    </span>
  );
}

export function getLanguageLabels() {
  return languageLabels;
}

export function getLocalizedPath(pathname: string, targetLocale: Locale) {
  const [pathOnly, query = ""] = pathname.split("?");
  const segments = pathOnly.split("/").filter(Boolean);
  const [currentLocale, ...rest] = segments;
  const suffix = query ? `?${query}` : "";

  if (!supportedLocales.includes(currentLocale as Locale)) {
    return `/${targetLocale}`;
  }

  const restPath = rest.length > 0 ? `/${rest.join("/")}` : "";

  return `/${targetLocale}${restPath}${suffix}`;
}

type LanguageSwitcherProps = {
  currentLocale: Locale;
  label?: string;
  variant?: "admin" | "public";
};

export function LanguageSwitcher({ currentLocale, label = "Language", variant = "public" }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const isAdmin = variant === "admin";
  const summaryClass = isAdmin
    ? "inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 [&::-webkit-details-marker]:hidden"
    : "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-cyan-300/15 bg-white/[0.05] px-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden";
  const menuClass = isAdmin
    ? "absolute right-0 top-12 z-[100] w-48 rounded-md border border-slate-200 bg-white p-1 shadow-xl"
    : "absolute right-0 top-12 z-[100] w-48 rounded-md border border-cyan-300/20 bg-slate-950/95 p-1 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl";
  const itemClass = isAdmin
    ? "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
    : "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-slate-100 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

  return (
    <details className="group relative">
      <summary aria-label={label} className={summaryClass}>
        <Globe aria-hidden="true" className="size-4 shrink-0" />
        <span>{languageLabels[currentLocale].short}</span>
      </summary>
      <div className={menuClass} role="menu">
        {supportedLocales.map((locale) => (
          <button
            className={`${itemClass} ${locale === currentLocale ? (isAdmin ? "bg-slate-100 text-slate-950" : "bg-cyan-300/10 text-cyan-100") : ""}`}
            key={locale}
            onClick={() => router.push(getLocalizedPath(currentPath, locale))}
            role="menuitem"
            type="button"
          >
            <LanguageBadge text={languageLabels[locale].short} />
            <span>{languageLabels[locale].label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
