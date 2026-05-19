import { jsonError, jsonOk } from "@/lib/api/responses";
import {
  checkConfirmationResendRateLimit,
  type ConfirmationResendLimitClient,
} from "@/lib/auth/confirmation-resend-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ResendConfirmationRequestBody = {
  callbackUrl?: string;
  email?: string;
};

function getIpAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.trim() ?? null;
}

function isSafeCallbackUrl(value: string, request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const callbackUrl = new URL(value);
    const allowedOrigins = new Set([new URL(request.url).origin, new URL(siteUrl).origin]);
    return allowedOrigins.has(callbackUrl.origin) && callbackUrl.pathname === "/auth/callback";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as ResendConfirmationRequestBody;
  const email = String(body.email ?? "").trim();
  const callbackUrl = String(body.callbackUrl ?? "").trim();

  if (!email || !callbackUrl || !isSafeCallbackUrl(callbackUrl, request)) {
    return jsonError("invalid_request");
  }

  const supabase = createSupabaseAdminClient();
  const limit = await checkConfirmationResendRateLimit(supabase as unknown as ConfirmationResendLimitClient, {
    email,
    ip: getIpAddress(request),
    userAgent: getUserAgent(request),
  });

  if (!limit.ok) {
    return jsonError("rate_limited", 429, {
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  try {
    await supabase.auth.resend({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
      type: "signup",
    });
  } catch {
    // Keep the response generic so this endpoint cannot be used to enumerate accounts.
  }

  return jsonOk({ ok: true });
}
