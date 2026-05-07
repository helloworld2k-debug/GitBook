import { supportedLocales, type Locale } from "@/config/site";

export function getActionLocale(locale: FormDataEntryValue | string | null | undefined) {
  const value = String(locale ?? "en");

  return supportedLocales.includes(value as Locale) ? value : "en";
}
