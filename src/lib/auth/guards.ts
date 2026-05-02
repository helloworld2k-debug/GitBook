import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { defaultLocale, supportedLocales, type Locale } from "@/config/site";
import { isSupabaseAuthCookieName } from "@/lib/auth/supabase-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "operator" | "user";
export type AccountStatus = "active" | "disabled";

type AdminLike = { is_admin?: boolean; admin_role?: AdminRole | null; account_status?: AccountStatus | null } | null;

export function sanitizeNextPath(nextPath: string | string[] | null | undefined, fallbackPath = "/en/dashboard") {
  const path = Array.isArray(nextPath) ? nextPath[0] : nextPath;

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallbackPath;
  }

  if (path.startsWith("/api/") || path.startsWith("/_next/") || path.includes("\\") || path.includes("\n")) {
    return fallbackPath;
  }

  return path;
}

export function getLocaleDashboardPath(locale: Locale | string | null | undefined) {
  return supportedLocales.includes(locale as Locale) ? `/${locale}/dashboard` : `/${defaultLocale}/dashboard`;
}

export function getLocaleFromPath(path: string | null | undefined): Locale {
  const segment = path?.split("/")[1];

  return supportedLocales.includes(segment as Locale) ? (segment as Locale) : defaultLocale;
}

export function getLoginRedirectPath(locale: Locale | string, nextPath: string) {
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

export function isAdminProfile(profile: AdminLike) {
  return profile?.account_status !== "disabled" && (profile?.is_admin === true || profile?.admin_role === "owner" || profile?.admin_role === "operator");
}

export function isOwnerProfile(profile: AdminLike) {
  return profile?.account_status !== "disabled" && (profile?.is_admin === true || profile?.admin_role === "owner");
}

async function hasSupabaseAuthCookie() {
  const cookieStore = await cookies();

  return cookieStore.getAll().some(({ name }) => isSupabaseAuthCookieName(name));
}

export async function requireUser(locale: Locale | string, nextPath: string) {
  if (!(await hasSupabaseAuthCookie())) {
    redirect(getLoginRedirectPath(locale, nextPath));
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(getLoginRedirectPath(locale, nextPath));
  }

  return data.user;
}

export async function requireAdmin(locale: Locale | string) {
  return requireOperator(locale);
}

export async function requireOperator(locale: Locale | string) {
  const user = await requireUser(locale, `/${locale}/admin`);
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("is_admin,admin_role,account_status").eq("id", user.id).single();

  if (!isAdminProfile(profile)) {
    redirect(`/${locale}/dashboard`);
  }

  return user;
}

export async function requireOwner(locale: Locale | string) {
  const user = await requireUser(locale, `/${locale}/admin`);
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("is_admin,admin_role,account_status").eq("id", user.id).single();

  if (!isOwnerProfile(profile)) {
    redirect(`/${locale}/admin`);
  }

  return user;
}
