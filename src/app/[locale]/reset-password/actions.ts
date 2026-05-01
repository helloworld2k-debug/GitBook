"use server";

import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeLocale(locale: string) {
  return supportedLocales.includes(locale as Locale) ? locale : "en";
}

function getResetPasswordPath(locale: string, status: "error" | "mismatch") {
  const safeLocale = getSafeLocale(locale);
  return `/${safeLocale}/reset-password?status=${status}`;
}

export async function updateResetPassword(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!password || password !== confirmPassword) {
    redirect(getResetPasswordPath(safeLocale, "mismatch"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(getResetPasswordPath(safeLocale, "error"));
  }

  redirect(`/${safeLocale}/login?password=reset`);
}
