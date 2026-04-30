"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { redeemTrialCode, type TrialRedeemFailure } from "@/lib/license/trial-codes";
import { updatePublicSupporterProfile } from "@/lib/profile/privacy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getDashboardPath(
  locale: string,
  params:
    | { privacy: "saved" | "error" }
    | { profile: "saved" | "error" }
    | { password: "saved" | "error" | "mismatch" }
    | { trial: "saved" | "invalid" | "inactive" | "limit" | "machine_used" | "duplicate" | "error" },
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

const trialStatusByReason: Record<TrialRedeemFailure, "invalid" | "inactive" | "limit" | "machine_used" | "duplicate"> = {
  duplicate_trial_code_user: "duplicate",
  machine_trial_used: "machine_used",
  trial_code_inactive: "inactive",
  trial_code_invalid: "invalid",
  trial_code_limit_reached: "limit",
};

export async function redeemDashboardTrialCode(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const code = String(formData.get("trial_code") ?? "").trim();
  const desktopSessionId = String(formData.get("desktop_session_id") ?? "").trim();
  const nowIso = new Date().toISOString();

  if (!code || !desktopSessionId) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase
    .from("desktop_sessions")
    .select("id,machine_code_hash")
    .eq("id", desktopSessionId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (sessionError || !session) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const result = await redeemTrialCode(createSupabaseAdminClient(), {
    userId: user.id,
    code,
    machineCodeHash: session.machine_code_hash,
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
