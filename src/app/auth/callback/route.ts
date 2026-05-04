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
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type === "signup") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });

    if (error) {
      return buildLoginRedirect(requestUrl, "callback", nextPath);
    }

    const locale = getLocaleFromPath(nextPath);
    return NextResponse.redirect(new URL(`/${locale}/dashboard?welcome=verified`, requestUrl.origin));
  }

  if (!code) {
    return buildLoginRedirect(requestUrl, "missing-code", nextPath);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(requestUrl, "callback", nextPath);
  }

  if (nextPath.endsWith("/reset-password")) {
    const locale = getLocaleFromPath(nextPath);
    return NextResponse.redirect(new URL(`/${locale}/reset-password`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
