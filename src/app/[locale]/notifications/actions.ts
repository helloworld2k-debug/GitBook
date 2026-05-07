"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { getActionLocale } from "@/lib/i18n/action-locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function markNotificationRead(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
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
