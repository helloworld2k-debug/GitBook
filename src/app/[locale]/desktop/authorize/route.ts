import { NextResponse } from "next/server";
import { z } from "zod";
import { supportedLocales, type Locale } from "@/config/site";
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

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = authorizeSchema.safeParse({
    deviceSessionId: url.searchParams.get("device_session_id"),
    returnUrl: url.searchParams.get("return_url"),
    state: url.searchParams.get("state"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Missing desktop authorization parameters" }, { status: 400 });
  }

  const { deviceSessionId, returnUrl, state } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const { code } = await createDesktopAuthCode(createSupabaseAdminClient(), {
    userId: user.id,
    deviceSessionId,
    returnUrl,
    state,
  });
  const callback = new URL(returnUrl);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", state);

  return NextResponse.redirect(callback);
}
