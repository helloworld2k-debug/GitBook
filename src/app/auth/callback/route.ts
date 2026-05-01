import { NextResponse } from "next/server";
import { getLocaleDashboardPath, getLocaleFromPath, sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildLoginRedirect(requestUrl: URL, error: string, nextPath: string) {
  const locale = getLocaleFromPath(nextPath);
  const loginUrl = new URL(`/${locale}/login`, requestUrl.origin);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedNext = requestUrl.searchParams.get("next");
  const nextPath = sanitizeNextPath(requestedNext, getLocaleDashboardPath(getLocaleFromPath(requestedNext)));
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return buildLoginRedirect(requestUrl, "missing-code", nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(requestUrl, "callback", nextPath);
  }

  if (requestUrl.searchParams.get("type") === "recovery") {
    const locale = getLocaleFromPath(nextPath);
    return NextResponse.redirect(new URL(`/${locale}/reset-password`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
