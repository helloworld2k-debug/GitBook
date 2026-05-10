import { jsonError, jsonOk } from "@/lib/api/responses";
import { checkRegisterRateLimit, type RegisterLimitClient } from "@/lib/auth/register-rate-limit";
import { registerWithEmailPassword } from "@/lib/auth/register";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RegisterRequestBody = {
  callbackUrl?: string;
  email?: string;
  password?: string;
  turnstileToken?: string;
};

type AuthSignupError = {
  code?: string;
  message?: string;
  status?: number;
};

function getIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() ?? null;
}

function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.trim() ?? null;
}

function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

function isAlreadyRegisteredError(error: AuthSignupError | null | undefined) {
  const code = error?.code?.toLowerCase();
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("user already registered") ||
    message.includes("already registered")
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterRequestBody;
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const callbackUrl = String(body.callbackUrl ?? "").trim();
  const turnstileToken = String(body.turnstileToken ?? "").trim();

  if (!email || !password || !callbackUrl) {
    return jsonError("invalid_request");
  }

  const requireTurnstile = isTurnstileConfigured();

  if (requireTurnstile && !turnstileToken) {
    return jsonError("captcha_required");
  }

  const ip = getIpAddress(request);
  const supabase = createSupabaseAdminClient() as unknown as RegisterLimitClient;
  const limit = await checkRegisterRateLimit(supabase, {
    email,
    ip,
    userAgent: getUserAgent(request),
  });

  if (!limit.ok) {
    return jsonError(
      "rate_limited",
      429,
      {
        headers: { "retry-after": String(limit.retryAfterSeconds) },
      },
    );
  }

  if (requireTurnstile) {
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);

    if (!turnstile.ok) {
      return jsonError("captcha_invalid");
    }
  }

  const result = await registerWithEmailPassword({
    callbackUrl,
    email,
    password,
  });

  if (isAlreadyRegisteredError(result.error)) {
    return jsonOk({ ok: true });
  }

  if (result.error) {
    return jsonError("register_failed");
  }

  return jsonOk({ ok: true });
}
