import { NextResponse } from "next/server";
import { defaultLocale, supportedLocales, type Locale } from "@/config/site";
import { sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getLocaleFromPath(path: string): Locale {
  const segment = path.split("/")[1];

  return supportedLocales.includes(segment as Locale) ? (segment as Locale) : defaultLocale;
}

function buildLoginRedirect(requestUrl: URL, error: string, nextPath: string) {
  const locale = getLocaleFromPath(nextPath);
  const loginUrl = new URL(`/${locale}/login`, requestUrl.origin);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"), `/${defaultLocale}/dashboard`);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return buildLoginRedirect(requestUrl, "missing-code", nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(requestUrl, "callback", nextPath);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
