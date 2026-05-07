import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";

export function resolvePageLocale(locale: string): Locale {
  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  return locale as Locale;
}
