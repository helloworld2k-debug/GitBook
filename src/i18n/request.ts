import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Cache English messages as fallback
let englishMessages: Record<string, unknown> | null = null;

async function getEnglishMessages() {
  if (!englishMessages) {
    englishMessages = (await import(`../../messages/en.json`)).default;
  }
  return englishMessages;
}

function getNestedValue(obj: Record<string, unknown> | null, path: string): string | undefined {
  if (!obj) return undefined;
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // For non-English locales, preload English messages as fallback
  const fallbackMessages = locale !== "en" ? await getEnglishMessages() : null;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    getMessageFallback:
      locale === "en"
        ? undefined
        : ({ namespace, key }) => {
            // Try to get from English messages
            const fullPath = namespace ? `${namespace}.${key}` : key;
            const fallbackValue = getNestedValue(fallbackMessages, fullPath);

            // Log missing translations in development
            if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
              if (!fallbackValue) {
                console.warn(`[i18n] Missing translation for ${locale}: ${fullPath} (no English fallback found)`);
              } else {
                console.warn(`[i18n] Missing translation for ${locale}: ${fullPath} (using English fallback)`);
              }
            }

            return fallbackValue ?? fullPath;
          },
  };
});
