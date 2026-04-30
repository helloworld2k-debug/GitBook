"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { updatePublicSupporterProfile } from "@/lib/profile/privacy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getDashboardPath(
  locale: string,
  params:
    | { privacy: "saved" | "error" }
    | { profile: "saved" | "error" }
    | { password: "saved" | "error" | "mismatch" },
) {
  const safeLocale = supportedLocales.includes(locale as Locale) ? locale : "en";
  const [key, value] = Object.entries(params)[0] ?? ["privacy", "error"];

  return `/${safeLocale}/dashboard?${key}=${value}`;
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
    redirect(getDashboardPath(safeLocale, { privacy: "error" }));
  }

  revalidatePath(`/${safeLocale}/dashboard`);
  revalidatePath(`/${safeLocale}/sponsors`);
  redirect(getDashboardPath(safeLocale, { privacy: "saved" }));
}

export async function updateAccountProfile(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const publicDisplayName = String(formData.get("public_display_name") ?? "").trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, public_display_name: publicDisplayName })
    .eq("id", user.id);

  if (error) {
    redirect(getDashboardPath(safeLocale, { profile: "error" }));
  }

  revalidatePath(`/${safeLocale}/dashboard`);
  revalidatePath(`/${safeLocale}/sponsors`);
  redirect(getDashboardPath(safeLocale, { profile: "saved" }));
}

export async function updateDashboardPassword(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password || password !== confirmPassword) {
    redirect(getDashboardPath(safeLocale, { password: "mismatch" }));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(getDashboardPath(safeLocale, { password: "error" }));
  }

  redirect(getDashboardPath(safeLocale, { password: "saved" }));
}
