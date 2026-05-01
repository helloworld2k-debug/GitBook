"use server";

import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getSafeLocale(locale: string) {
  return supportedLocales.includes(locale as Locale) ? locale : "en";
}

export async function markNotificationRead(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/notifications`);
  const notificationId = String(formData.get("notification_id") ?? "").trim();

  if (!notificationId) {
    throw new Error("Notification is required");
  }

  const { error } = await createSupabaseAdminClient().from("notification_reads").upsert({
    notification_id: notificationId,
    read_at: new Date().toISOString(),
    user_id: user.id,
  });

  if (error) {
    throw new Error("Unable to mark notification read");
  }

  revalidatePath(`/${safeLocale}/notifications`);
}
