"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";

const languageLabels: Record<Locale, { short: string; label: string }> = {
  en: { short: "EN", label: "English" },
  "zh-Hant": { short: "繁", label: "繁體中文" },
  ja: { short: "日", label: "日本語" },
  ko: { short: "한", label: "한국어" },
};

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
};

export function LanguageSwitcher({ currentLocale, label = "Language" }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/15 bg-white/[0.05] px-2 text-xs font-semibold text-cyan-100">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{languageLabels[currentLocale].short}</span>
      <select
        aria-label={label}
        className="min-h-8 rounded-md border border-transparent bg-transparent text-sm font-semibold text-cyan-100 outline-none focus-visible:border-cyan-300"
        onChange={(event) => router.push(getLocalizedPath(currentPath, event.target.value as Locale))}
        value={currentLocale}
      >
        {supportedLocales.map((locale) => (
          <option className="bg-slate-950 text-white" key={locale} value={locale}>
            {languageLabels[locale].label}
          </option>
        ))}
      </select>
    </label>
  );
}
