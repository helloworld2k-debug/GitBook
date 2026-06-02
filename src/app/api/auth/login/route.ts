import { jsonError, jsonOk } from "@/lib/api/responses";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { getRequestIpAddress, getRequestUserAgent, recordUserLoginSafely } from "@/lib/auth/login-history";
import { checkLoginRisk, recordLoginAttempt, type LoginRiskClient } from "@/lib/auth/login-risk";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

async function recordLoginAttemptSafely(
  client: LoginRiskClient,
  input: Parameters<typeof recordLoginAttempt>[1],
) {
  try {
    await recordLoginAttempt(client, input);
  } catch {
    // Login attempt tracking is supplemental; auth should still return the credential result.
  }
}

const loginSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(1).max(1024),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return jsonError("invalid_request", 403);
  }

  const raw = await request.json();
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("invalid_request");
  }
  const { email, password, turnstileToken } = parsed.data;
  const turnstileTokenTrimmed = turnstileToken?.trim() ?? "";

  const ip = getRequestIpAddress(request);
  const userAgent = getRequestUserAgent(request);
  const adminClient = createSupabaseAdminClient() as unknown as LoginRiskClient;
  let risk: { captchaRequired: boolean };
  const turnstileConfigured = isTurnstileConfigured();

  try {
    risk = await checkLoginRisk(adminClient, { email, ip });
  } catch {
    console.error("login risk check failed — requiring captcha as fallback");
    risk = { captchaRequired: turnstileConfigured };
  }

  if (risk.captchaRequired) {
    if (!isTurnstileConfigured() || !turnstileTokenTrimmed) {
      return jsonError("captcha_required");
    }

    const turnstile = await verifyTurnstileToken(turnstileTokenTrimmed, ip);

    if (!turnstile.ok) {
      return jsonError("captcha_invalid");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordLoginAttemptSafely(adminClient, {
      email,
      ip,
      result: "failure",
      userAgent,
    });
    return jsonError("invalid_credentials", 401);
  }

  if (data?.user) {
    await recordUserLoginSafely({
      ip,
      loginMethod: "email",
      userAgent,
      userId: data.user.id,
    });
  }

  await recordLoginAttemptSafely(adminClient, {
    email,
    ip,
    result: "success",
    userAgent,
  });

  return jsonOk({ ok: true });
}
