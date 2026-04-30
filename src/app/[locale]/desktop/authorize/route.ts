import { NextResponse } from "next/server";
import { supportedLocales, type Locale } from "@/config/site";
import { createDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeReturnUrl(value: string | null) {
  if (!value || !value.startsWith("gitbookai://auth/callback")) {
    return null;
  }

  return value;
}

function safeDeviceSessionId(value: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 404 });
  }

  const url = new URL(request.url);
  const deviceSessionId = safeDeviceSessionId(url.searchParams.get("device_session_id"));
  const returnUrl = safeReturnUrl(url.searchParams.get("return_url"));

  if (!deviceSessionId || !returnUrl) {
    return NextResponse.json({ error: "Missing desktop authorization parameters" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}`;

    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const { code } = await createDesktopAuthCode(createSupabaseAdminClient(), {
    userId: user.id,
    deviceSessionId,
    returnUrl,
  });
  const callback = new URL(returnUrl);
  callback.searchParams.set("code", code);

  return NextResponse.redirect(callback);
}
