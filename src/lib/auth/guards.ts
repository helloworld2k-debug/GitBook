import { redirect } from "next/navigation";
import type { Locale } from "@/config/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminLike = { is_admin: boolean } | null;

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

export function getLoginRedirectPath(locale: Locale | string, nextPath: string) {
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

export function isAdminProfile(profile: AdminLike) {
  return profile?.is_admin === true;
}

export async function requireUser(locale: Locale | string, nextPath: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(getLoginRedirectPath(locale, nextPath));
  }

  return data.user;
}

export async function requireAdmin(locale: Locale | string) {
  const user = await requireUser(locale, `/${locale}/admin`);
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!isAdminProfile(profile)) {
    redirect(`/${locale}/dashboard`);
  }

  return user;
}
