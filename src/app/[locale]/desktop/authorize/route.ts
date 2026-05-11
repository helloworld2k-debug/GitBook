import { NextResponse } from "next/server";
import { z } from "zod";
import { supportedLocales, type Locale } from "@/config/site";
import { jsonError } from "@/lib/api/responses";
import { createDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const authorizeSchema = z.object({
  deviceSessionId: z.string().trim().min(1).max(200),
  state: z.string().trim().min(8).max(300),
  returnUrl: z
    .string()
    .min(1)
    .max(500)
    .refine((value) => {
      try {
        const url = new URL(value);

        return (
          url.protocol === "gitbookai:" &&
          url.host === "auth" &&
          url.pathname === "/callback" &&
          url.search === "" &&
          url.hash === ""
        );
      } catch {
        return false;
      }
    }),
});

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function desktopCallbackResponse(callbackUrl: string) {
  const escapedUrl = htmlEscape(callbackUrl);
  const serializedUrl = JSON.stringify(callbackUrl);

  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening GitBook AI</title>
  </head>
  <body>
    <p>Opening GitBook AI...</p>
    <p><a href="${escapedUrl}">Open GitBook AI</a></p>
    <script>
      window.location.href = ${serializedUrl};
    </script>
  </body>
</html>`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    return jsonError("Unsupported locale", 404);
  }

  const url = new URL(request.url);
  const parsed = authorizeSchema.safeParse({
    deviceSessionId: url.searchParams.get("device_session_id"),
    returnUrl: url.searchParams.get("return_url"),
    state: url.searchParams.get("state"),
  });

  if (!parsed.success) {
    return jsonError("Missing desktop authorization parameters");
  }

  const { deviceSessionId, returnUrl, state } = parsed.data;
  const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}&state=${encodeURIComponent(state)}`;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/desktop/login?next=${encodeURIComponent(next)}`, request.url));
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { code } = await createDesktopAuthCode(adminClient, {
      userId: user.id,
      deviceSessionId,
      returnUrl,
      state,
    });
    const callback = new URL(returnUrl);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);

    return desktopCallbackResponse(callback.toString());
  } catch (error) {
    console.error("Unable to create desktop auth code", error);
    const loginUrl = new URL(`/${locale}/desktop/login`, request.url);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", "desktop_authorize_failed");

    return NextResponse.redirect(loginUrl);
  }
}
