"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getActionLocale } from "@/lib/i18n/action-locale";
import { redeemTrialCode, type TrialRedeemFailure } from "@/lib/license/trial-codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getDashboardPath(
  locale: string,
  params:
    | { profile: "saved" | "error" }
    | { password: "saved" | "error" | "mismatch" }
    | { trial: "saved" | "invalid" | "inactive" | "limit" | "machine_used" | "duplicate" | "error" },
) {
  const safeLocale = getActionLocale(locale);
  const [key, value] = Object.entries(params)[0] ?? ["profile", "error"];

  return `/${safeLocale}/dashboard?${key}=${value}`;
}

export async function updateAccountProfile(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    redirect(getDashboardPath(safeLocale, { profile: "error" }));
  }

  revalidatePath(`/${safeLocale}/dashboard`);
  redirect(getDashboardPath(safeLocale, { profile: "saved" }));
}

export async function updateDashboardPassword(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
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

const trialStatusByReason: Record<TrialRedeemFailure, "invalid" | "inactive" | "limit" | "duplicate"> = {
  duplicate_trial_code_machine: "duplicate",
  duplicate_trial_code_user: "duplicate",
  trial_code_inactive: "inactive",
  trial_code_invalid: "invalid",
  trial_code_limit_reached: "limit",
};

export async function redeemDashboardTrialCode(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const code = String(formData.get("trial_code") ?? "").trim();

  if (!code) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const result = await redeemTrialCode(createSupabaseAdminClient(), {
    userId: user.id,
    code,
  }).catch(() => null);

  if (!result) {
    redirect(getDashboardPath(safeLocale, { trial: "error" }));
  }

  if (result.ok) {
    revalidatePath(`/${safeLocale}/dashboard`);
    redirect(getDashboardPath(safeLocale, { trial: "saved" }));
  }

  redirect(getDashboardPath(safeLocale, { trial: trialStatusByReason[result.reason] }));
}

export async function signOutAction(locale: string) {
  const safeLocale = getActionLocale(locale);
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect(`/${safeLocale}`);
}
