"use server";

import { redirect } from "next/navigation";
import { getActionLocale } from "@/lib/i18n/action-locale";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getResetPasswordPath(locale: string, status: "error" | "mismatch") {
  const safeLocale = getActionLocale(locale);
  return `/${safeLocale}/reset-password?status=${status}`;
}

export async function updateResetPassword(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
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
