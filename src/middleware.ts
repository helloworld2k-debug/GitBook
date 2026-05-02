import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isSupabaseAuthCookieName } from "./lib/auth/supabase-cookies";
import { refreshSupabaseSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => isSupabaseAuthCookieName(name));
}

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !hasSupabaseAuthCookie(request)
  ) {
    return response;
  }

  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: ["/((?!api|auth/callback|_next|_vercel|.*\\..*).*)"],
};
