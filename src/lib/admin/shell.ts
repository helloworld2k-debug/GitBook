import { getLocale, getTranslations } from "next-intl/server";
import { supportedLocales, type Locale } from "@/config/site";
import { optionalTimeout } from "@/lib/async/optional-timeout";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAdminShellProps(locale: Locale, currentPath: string) {
  const shellT = await getTranslations("admin.shell");
  let localeValue: string = locale;

  try {
    localeValue = await getLocale();
  } catch {
    localeValue = locale;
  }
  const currentLocale = supportedLocales.includes(localeValue as Locale) ? (localeValue as Locale) : locale;
  let adminLabel = "Admin";

  try {
    const supabase = await createSupabaseServerClient();
    const authResult = await optionalTimeout(supabase.auth.getUser(), 900);
    const user = authResult?.data.user;

    if (user) {
      const profileResult = await optionalTimeout(
        Promise.resolve(supabase.from("profiles").select("display_name,email").eq("id", user.id).single()),
        900,
      );
      const profile = profileResult?.data;
      adminLabel = profile?.display_name || profile?.email || user.email || adminLabel;
    }
  } catch {
    adminLabel = "Admin";
  }

  return {
    adminLabel,
    currentPath,
    labels: {
      auditLogs: shellT("auditLogs"),
      backToAdmin: shellT("backToAdmin"),
      certificates: shellT("certificates"),
      dashboard: shellT("dashboard"),
      donations: shellT("donations"),
      language: shellT("language"),
      licenses: shellT("licenses"),
      menu: shellT("menu"),
      notifications: shellT("notifications"),
      releases: shellT("releases"),
      returnToSite: shellT("returnToSite"),
      supportFeedback: shellT("supportFeedback"),
      supportSettings: shellT("supportSettings"),
      users: shellT("users"),
    },
    locale: currentLocale,
  };
}
