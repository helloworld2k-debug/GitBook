"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBoundedString, getOptionalDateIso, getRequiredString, getSafeLocale, MAX_NOTIFICATION_BODY_LENGTH, MAX_NOTIFICATION_TITLE_LENGTH, notificationAudiences, notificationPriorities } from "./validation";

export async function createNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const title = getBoundedString(formData, "title", "Title is required", MAX_NOTIFICATION_TITLE_LENGTH);
  const body = getBoundedString(formData, "body", "Body is required", MAX_NOTIFICATION_BODY_LENGTH);
  const notificationLocale = String(formData.get("notification_locale") ?? "").trim();
  const audience = getRequiredString(formData, "audience", "Audience is required");
  const priority = getRequiredString(formData, "priority", "Priority is required");
  const expiresAt = getOptionalDateIso(formData, "expires_at");
  const shouldPublish = formData.get("publish_now") === "on";

  if (!notificationAudiences.includes(audience as (typeof notificationAudiences)[number])) {
    throw new Error("Invalid audience");
  }

  if (!notificationPriorities.includes(priority as (typeof notificationPriorities)[number])) {
    throw new Error("Invalid priority");
  }

  if (notificationLocale && !supportedLocales.includes(notificationLocale as Locale)) {
    throw new Error("Invalid locale");
  }

  const safeNotificationLocale = notificationLocale ? (notificationLocale as Locale) : null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notifications").insert({
    audience: audience as (typeof notificationAudiences)[number],
    body,
    created_by: admin.id,
    expires_at: expiresAt,
    locale: safeNotificationLocale,
    priority: priority as (typeof notificationPriorities)[number],
    published_at: shouldPublish ? new Date().toISOString() : null,
    title,
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-created",
    locale,
    tone: "notice",
  });
}

export async function publishNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const notificationId = getRequiredString(formData, "notification_id", "Notification is required");
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-published",
    locale,
    tone: "notice",
  });
}

export async function unpublishNotification(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const notificationId = getRequiredString(formData, "notification_id", "Notification is required");
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .update({ published_at: null, updated_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/notifications",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/notifications`);
  revalidatePath(`/${locale}/notifications`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/notifications",
    formData,
    key: "notification-unpublished",
    locale,
    tone: "notice",
  });
}
