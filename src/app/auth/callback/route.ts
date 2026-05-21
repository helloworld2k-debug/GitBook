import { NextResponse } from "next/server";
import { getLocaleDashboardPath, getLocaleFromPath, sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

  if (tokenHash && (type === "signup" || type === "invite")) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      return buildLoginRedirect(requestUrl, "callback", nextPath);
    }

    if (data.user) {
      const adminClient = createSupabaseAdminClient();
      await adminClient.from("profiles").update({ email_verified: true }).eq("id", data.user.id);
    }

    const locale = getLocaleFromPath(nextPath);
    if (type === "invite") {
      return NextResponse.redirect(new URL(`/${locale}/reset-password`, requestUrl.origin));
    }

    return NextResponse.redirect(new URL(`/${locale}/dashboard?welcome=verified`, requestUrl.origin));
  }

  if (!code) {
    return buildLoginRedirect(requestUrl, "missing-code", nextPath);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildLoginRedirect(requestUrl, "callback", nextPath);
  }

  if (data.user) {
    const adminClient = createSupabaseAdminClient();
    await adminClient.from("profiles").update({ email_verified: true }).eq("id", data.user.id).eq("email_verified", false);
  }

  if (nextPath.endsWith("/reset-password")) {
    const locale = getLocaleFromPath(nextPath);
    return NextResponse.redirect(new URL(`/${locale}/reset-password`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
