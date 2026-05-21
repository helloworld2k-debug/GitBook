import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getLocaleDashboardPath, getLocaleFromPath, sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseBrowserConfig } from "@/lib/supabase/env";

function buildLoginRedirect(requestUrl: URL, error: string, nextPath: string) {
  const locale = getLocaleFromPath(nextPath);
  const loginUrl = new URL(`/${locale}/login`, requestUrl.origin);
  loginUrl.searchParams.set("error", error);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const requestedNext = requestUrl.searchParams.get("next");
  const nextPath = sanitizeNextPath(requestedNext, getLocaleDashboardPath(getLocaleFromPath(requestedNext)));
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const { url, anonKey } = getSupabaseBrowserConfig();

  if (tokenHash && (type === "signup" || type === "invite")) {
    const locale = getLocaleFromPath(nextPath);
    const redirectUrl =
      type === "invite"
        ? new URL(`/${locale}/reset-password`, requestUrl.origin)
        : new URL(`/${locale}/dashboard?welcome=verified`, requestUrl.origin);

    const response = NextResponse.redirect(redirectUrl);
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "signup" | "invite" });

    if (error) {
      // If verifyOtp fails (e.g. email already confirmed by admin), the user
      // may still be valid. Try to create a session via admin magic link.
      if (type === "signup") {
        const adminClient = createSupabaseAdminClient();

        // The signup email address is embedded in the JWT token_hash. We can
        // parse it to find the user, but that's fragile. Instead, just redirect
        // to login so the user can sign in normally — their email IS confirmed.
        return buildLoginRedirect(requestUrl, "callback", nextPath);
      }

      return buildLoginRedirect(requestUrl, "callback", nextPath);
    }

    if (data.user) {
      const adminClient = createSupabaseAdminClient();
      await adminClient.from("profiles").update({ email_verified: true }).eq("id", data.user.id);
    }

    return response;
  }

  if (!code) {
    return buildLoginRedirect(requestUrl, "missing-code", nextPath);
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

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

  return response;
}
