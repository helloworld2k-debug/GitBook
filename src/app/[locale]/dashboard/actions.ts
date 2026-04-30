"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { updatePublicSupporterProfile } from "@/lib/profile/privacy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getDashboardPath(locale: string, status: "saved" | "error") {
  const safeLocale = supportedLocales.includes(locale as Locale) ? locale : "en";

  return `/${safeLocale}/dashboard?privacy=${status}`;
}

function getSafeLocale(locale: string) {
  return supportedLocales.includes(locale as Locale) ? locale : "en";
}

export async function updatePublicSupporterPrivacy(locale: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const privacyClient = supabase as unknown as Parameters<typeof updatePublicSupporterProfile>[0];
  const safeLocale = getSafeLocale(locale);

  try {
    await updatePublicSupporterProfile(privacyClient, {
      publicSupporterEnabled: formData.get("public_supporter_enabled") === "on",
      publicDisplayName: String(formData.get("public_display_name") ?? ""),
    });
  } catch {
    redirect(getDashboardPath(safeLocale, "error"));
  }

  revalidatePath(`/${safeLocale}/dashboard`);
  revalidatePath(`/${safeLocale}/sponsors`);
  redirect(getDashboardPath(safeLocale, "saved"));
}
