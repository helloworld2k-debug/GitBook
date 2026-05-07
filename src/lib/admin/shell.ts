import { getLocale, getTranslations } from "next-intl/server";
import { enrichFeedbackUnreadState, type FeedbackUnreadSource } from "@/lib/admin/support-feedback-unread";
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
  let unreadFeedbackCount = 0;

  try {
    const supabase = await createSupabaseServerClient();
    const authResult = await optionalTimeout(supabase.auth.getUser(), 900);
    const user = authResult?.data.user;

    if (user) {
      const feedbackResult = await optionalTimeout(
        Promise.resolve(
          supabase
            .from("support_feedback")
            .select("id,created_at,support_feedback_admin_reads(admin_user_id,read_at),support_feedback_messages(author_role,created_at)")
            .order("updated_at", { ascending: false })
            .limit(100),
        ),
        900,
      );
      unreadFeedbackCount = enrichFeedbackUnreadState((feedbackResult?.data ?? []) as FeedbackUnreadSource[], user.id)
        .filter((feedback) => feedback.isUnread).length;

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
      contributionPricing: shellT("contributionPricing"),
      dashboard: shellT("dashboard"),
      donations: shellT("donations"),
      language: shellT("language"),
      licenses: shellT("licenses"),
      menu: shellT("menu"),
      notifications: shellT("notifications"),
      releases: shellT("releases"),
      returnToSite: shellT("returnToSite"),
      signOut: shellT("signOut"),
      supportFeedback: shellT("supportFeedback"),
      supportFeedbackUnread: (count: number) => shellT("supportFeedbackUnread", { count }),
      supportSettings: shellT("supportSettings"),
      users: shellT("users"),
    },
    locale: currentLocale,
    unreadFeedbackCount,
  };
}
