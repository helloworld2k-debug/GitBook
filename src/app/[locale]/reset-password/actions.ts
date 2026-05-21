"use server";

import { redirect } from "next/navigation";
import { getActionLocale } from "@/lib/i18n/action-locale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
  confirm_password: z.string().min(8).max(128),
});

function getResetPasswordPath(locale: string, status: "error" | "mismatch" | "unverified" | "weak") {
  const safeLocale = getActionLocale(locale);
  return `/${safeLocale}/reset-password?status=${status}`;
}

export async function updateResetPassword(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const adminClient = createSupabaseAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email_verified")
      .eq("id", user.id)
      .single();

    if (!profile?.email_verified) {
      redirect(getResetPasswordPath(safeLocale, "unverified"));
    }
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    redirect(getResetPasswordPath(safeLocale, "weak"));
  }

  const { password, confirm_password: confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    redirect(getResetPasswordPath(safeLocale, "mismatch"));
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(getResetPasswordPath(safeLocale, "error"));
  }

  redirect(`/${safeLocale}/login?password=reset`);
}
