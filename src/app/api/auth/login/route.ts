import { jsonError, jsonOk } from "@/lib/api/responses";
import { checkLoginRisk, recordLoginAttempt, type LoginRiskClient } from "@/lib/auth/login-risk";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginRequestBody = {
  email?: string;
  password?: string;
  turnstileToken?: string;
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

export async function POST(request: Request) {
  const body = (await request.json()) as LoginRequestBody;
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const turnstileToken = String(body.turnstileToken ?? "").trim();

  if (!email || !password) {
    return jsonError("invalid_request");
  }

  const ip = getIpAddress(request);
  const adminClient = createSupabaseAdminClient() as unknown as LoginRiskClient;
  const risk = await checkLoginRisk(adminClient, { email, ip });

  if (risk.captchaRequired) {
    if (!isTurnstileConfigured() || !turnstileToken) {
      return jsonError("captcha_required");
    }

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);

    if (!turnstile.ok) {
      return jsonError("captcha_invalid");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordLoginAttempt(adminClient, {
      email,
      ip,
      result: "failure",
      userAgent: getUserAgent(request),
    });
    return jsonError("invalid_credentials", 401);
  }

  await recordLoginAttempt(adminClient, {
    email,
    ip,
    result: "success",
    userAgent: getUserAgent(request),
  });

  return jsonOk({ ok: true });
}
