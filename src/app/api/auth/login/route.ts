import { jsonError, jsonOk } from "@/lib/api/responses";
import { checkLoginRisk, recordLoginAttempt, type LoginRiskClient } from "@/lib/auth/login-risk";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

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
  const raw = await request.json();
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("invalid_request");
  }
  const { email, password, turnstileToken } = parsed.data;
  const turnstileTokenTrimmed = turnstileToken?.trim() ?? "";

  const ip = getIpAddress(request);
  const adminClient = createSupabaseAdminClient() as unknown as LoginRiskClient;
  let risk: { captchaRequired: boolean };

  try {
    risk = await checkLoginRisk(adminClient, { email, ip });
  } catch {
    risk = { captchaRequired: false };
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
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await recordLoginAttemptSafely(adminClient, {
      email,
      ip,
      result: "failure",
      userAgent: getUserAgent(request),
    });
    return jsonError("invalid_credentials", 401);
  }

  await recordLoginAttemptSafely(adminClient, {
    email,
    ip,
    result: "success",
    userAgent: getUserAgent(request),
  });

  return jsonOk({ ok: true });
}
