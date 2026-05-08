import { NextResponse } from "next/server";
import { z } from "zod";
import { supportedLocales, type Locale } from "@/config/site";
import { jsonError } from "@/lib/api/responses";
import { isSupabaseAuthCookieName } from "@/lib/auth/supabase-cookies";
import { createDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

function readAccessTokenFromAuthCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((item) => item.trim()).filter(Boolean);

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    let name: string;
    let value: string;

    try {
      name = decodeURIComponent(cookie.slice(0, separatorIndex));
      value = decodeURIComponent(cookie.slice(separatorIndex + 1));
    } catch {
      continue;
    }

    if (!isSupabaseAuthCookieName(name) || !value) {
      continue;
    }

    let parsed: { access_token?: string } | [string, string];

    try {
      const rawPayload = value.startsWith("base64-") ? decodeBase64Url(value.slice("base64-".length)) : value;
      parsed = JSON.parse(rawPayload) as { access_token?: string } | [string, string];
    } catch {
      continue;
    }

    if (Array.isArray(parsed)) {
      return parsed[0] ?? null;
    }

    return parsed.access_token ?? null;
  }

  return null;
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

  const accessToken = readAccessTokenFromAuthCookie(request);

  if (!accessToken) {
    const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const adminClient = createSupabaseAdminClient();
  const {
    data: { user },
  } = await adminClient.auth.getUser(accessToken);

  if (!user) {
    const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(next)}`, request.url));
  }

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
}
