"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getActionLocale } from "@/lib/i18n/action-locale";
import { redeemLicenseCode } from "@/lib/license/trial-codes";
import { hashDesktopSecret } from "@/lib/license/hash";
import { checkLicenseRedeemRisk, recordLicenseRedeemAttempt, type RedeemSecurityClient } from "@/lib/license/redeem-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

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

function getIpAddress(headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || null;
}

export async function redeemDashboardLicenseCode(locale: string, formData: FormData) {
  const safeLocale = getActionLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const code = String(formData.get("license_code") ?? formData.get("trial_code") ?? "").trim();

  if (!code) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const supabase = createSupabaseAdminClient();
  const redeemSecurityClient = supabase as unknown as RedeemSecurityClient;
  const headerStore = await headers();
  const ipAddress = getIpAddress(headerStore);
  const userAgent = headerStore.get("user-agent");
  const codeHash = await hashDesktopSecret(code, "trial_code");
  const risk = await checkLicenseRedeemRisk(redeemSecurityClient, {
    ipAddress,
    userId: user.id,
  }).catch(() => ({ ok: true as const }));

  if (!risk.ok) {
    await recordLicenseRedeemAttempt(redeemSecurityClient, {
      codeHash,
      ipAddress,
      reason: risk.reason,
      result: "blocked",
      userAgent,
      userId: user.id,
    }).catch(() => undefined);
    redirect(getDashboardPath(safeLocale, { trial: "error" }));
  }

  const result = await redeemLicenseCode(supabase, {
    userId: user.id,
    code,
  }).catch(() => null);

  if (!result) {
    await recordLicenseRedeemAttempt(redeemSecurityClient, {
      codeHash,
      ipAddress,
      reason: "unexpected_error",
      result: "failure",
      userAgent,
      userId: user.id,
    }).catch(() => undefined);
    redirect(getDashboardPath(safeLocale, { trial: "error" }));
  }

  if (result.ok) {
    await recordLicenseRedeemAttempt(redeemSecurityClient, {
      codeHash,
      ipAddress,
      reason: "redeemed",
      result: "success",
      userAgent,
      userId: user.id,
    }).catch(() => undefined);
    revalidatePath(`/${safeLocale}/dashboard`);
    redirect(getDashboardPath(safeLocale, { trial: "saved" }));
  }

  await recordLicenseRedeemAttempt(redeemSecurityClient, {
    codeHash,
    ipAddress,
    reason: result.reason,
    result: "failure",
    userAgent,
    userId: user.id,
  }).catch(() => undefined);
  redirect(getDashboardPath(safeLocale, { trial: "error" }));
}

export const redeemDashboardTrialCode = redeemDashboardLicenseCode;

export async function signOutAction(locale: string) {
  const safeLocale = getActionLocale(locale);
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  redirect(`/${safeLocale}`);
}
