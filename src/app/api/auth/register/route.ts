import { jsonError, jsonOk } from "@/lib/api/responses";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { checkRegisterRateLimit, type RegisterLimitClient } from "@/lib/auth/register-rate-limit";
import { registerWithEmailPassword } from "@/lib/auth/register";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

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

function shouldBypassEmailConfirmation() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.TEMP_DISABLE_EMAIL_CONFIRMATION === "true";
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

async function registerConfirmedUserWithEmailPassword(input: {
  email: string;
  password: string;
}) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
    user_metadata: {
      source: "register_form",
    },
  });

  if (!isAlreadyRegisteredError(result.error)) {
    return result;
  }

  // Paginate through users to find the unconfirmed one with this email.
  // listUsers returns max 50 per page, so we must paginate.
  let page = 1;
  const perPage = 50;
  let existingUser: { id: string; email_confirmed_at?: string | null } | null = null;

  while (!existingUser) {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (usersError) {
      return { data: { user: null }, error: usersError };
    }

    if (usersData.users.length === 0) {
      break;
    }

    existingUser =
      usersData.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase()) ?? null;

    if (usersData.users.length < perPage) {
      break;
    }

    page++;
  }

  if (!existingUser || existingUser.email_confirmed_at) {
    return { data: { user: null }, error: null };
  }

  return supabase.auth.admin.updateUserById(existingUser.id, {
    email_confirm: true,
    password: input.password,
    user_metadata: {
      source: "register_form",
    },
  });
}

const registerSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(8).max(128),
  callbackUrl: z.string().url().max(2048),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return jsonError("invalid_request", 403);
  }

  const raw = await request.json();
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("invalid_request");
  }
  const { email, password, callbackUrl } = parsed.data;
  const turnstileToken = parsed.data.turnstileToken?.trim() ?? "";

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

  const bypassEmailConfirmation = shouldBypassEmailConfirmation();
  const result = bypassEmailConfirmation
    ? await registerConfirmedUserWithEmailPassword({
      email,
      password,
    })
    : await registerWithEmailPassword({
      callbackUrl,
      email,
      password,
    });

  if (!bypassEmailConfirmation && isAlreadyRegisteredError(result.error)) {
    return jsonError("account_exists", 409);
  }

  if (result.error) {
    return jsonError("register_failed");
  }

  return jsonOk({ ok: true, ...(bypassEmailConfirmation && result.data.user ? { emailConfirmationBypassed: true } : {}) });
}
