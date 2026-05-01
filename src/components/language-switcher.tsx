"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";

const languageLabels: Record<Locale, { short: string; label: string; countryCode: "US" | "TW" | "JP" | "KR" }> = {
  en: { short: "EN", label: "English", countryCode: "US" },
  "zh-Hant": { short: "繁", label: "繁體中文", countryCode: "TW" },
  ja: { short: "日", label: "日本語", countryCode: "JP" },
  ko: { short: "한", label: "한국어", countryCode: "KR" },
};

function FlagIcon({ countryCode }: { countryCode: (typeof languageLabels)[Locale]["countryCode"] }) {
  const label = `${countryCode} flag`;
  const clipId = useId();

  if (countryCode === "US") {
    return (
      <svg aria-label={label} className="size-5 shrink-0 rounded-full" viewBox="0 0 32 32" role="img">
        <clipPath id={clipId}><circle cx="16" cy="16" r="16" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <path fill="#fff" d="M0 0h32v32H0z" />
          {Array.from({ length: 7 }).map((_, index) => (
            <path fill="#b22234" d={`M0 ${index * 5}h32v2.5H0z`} key={index} />
          ))}
          <path fill="#3c3b6e" d="M0 0h15.2v17.5H0z" />
          <path fill="#fff" d="M3 4h2v2H3zm5 0h2v2H8zm-5 5h2v2H3zm5 0h2v2H8zm-5 5h2v2H3zm5 0h2v2H8z" />
        </g>
      </svg>
    );
  }

  if (countryCode === "TW") {
    return (
      <svg aria-label={label} className="size-5 shrink-0 rounded-full" viewBox="0 0 32 32" role="img">
        <clipPath id={clipId}><circle cx="16" cy="16" r="16" /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          <path fill="#fe0000" d="M0 0h32v32H0z" />
          <path fill="#000095" d="M0 0h16v16H0z" />
          <circle cx="8" cy="8" r="4.2" fill="#fff" />
          <circle cx="8" cy="8" r="2.4" fill="#000095" />
        </g>
      </svg>
    );
  }

  if (countryCode === "JP") {
    return (
      <svg aria-label={label} className="size-5 shrink-0 rounded-full" viewBox="0 0 32 32" role="img">
        <circle cx="16" cy="16" r="16" fill="#fff" />
        <circle cx="16" cy="16" r="7" fill="#bc002d" />
      </svg>
    );
  }

  return (
    <svg aria-label={label} className="size-5 shrink-0 rounded-full" viewBox="0 0 32 32" role="img">
      <clipPath id={clipId}><circle cx="16" cy="16" r="16" /></clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path fill="#fff" d="M0 0h32v32H0z" />
        <path fill="#cd2e3a" d="M16 8a8 8 0 0 1 0 16 4 4 0 0 1 0-8 4 4 0 0 0 0-8z" />
        <path fill="#0047a0" d="M16 24a8 8 0 0 1 0-16 4 4 0 0 1 0 8 4 4 0 0 0 0 8z" />
        <path stroke="#111827" strokeWidth="1.4" d="M6 7l5 5m-3-7l5 5m8 12l5 5m-3-7l5 5M25 7l-5 5m7-3l-5 5M7 25l5-5m-7 3l5-5" />
      </g>
    </svg>
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
        <FlagIcon countryCode={languageLabels[currentLocale].countryCode} />
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
            <FlagIcon countryCode={languageLabels[locale].countryCode} />
            <span>{languageLabels[locale].label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
