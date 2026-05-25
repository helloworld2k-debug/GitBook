import { jsonError, jsonOk } from "@/lib/api/responses";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { checkRegisterRateLimit, type RegisterLimitClient } from "@/lib/auth/register-rate-limit";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

type AuthSignupError = {
  code?: string;
  message?: string;
  status?: number;
};

type ExistingAuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
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
  let page = 1;
  const perPage = 50;
  let existingUser: ExistingAuthUser | null = null;

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

  if (!existingUser) {
    return result;
  }

  if (existingUser.email_confirmed_at) {
    await ensureProfileForAuthUser(supabase, existingUser);

    return {
      data: { user: null },
      error: { code: "email_exists", message: "User already registered", status: 422 },
    };
  }

  return supabase.auth.admin.updateUserById(existingUser.id, {
    email_confirm: true,
    password: input.password,
    user_metadata: {
      source: "register_form",
    },
  });
}

async function ensureProfileForAuthUser(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  user: ExistingAuthUser,
) {
  const metadata = user.raw_user_meta_data ?? {};
  const preferredLocale = metadata.preferred_locale;
  const displayName = metadata.display_name ?? metadata.full_name ?? metadata.name ?? metadata.user_name;
  const publicDisplayName = metadata.public_display_name ?? displayName;

  await supabase.from("profiles").upsert(
    {
      avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      display_name: typeof displayName === "string" ? displayName : null,
      email: user.email ?? "",
      email_verified: Boolean(user.email_confirmed_at),
      id: user.id,
      is_admin: false,
      preferred_locale:
        preferredLocale === "en" || preferredLocale === "zh-Hant" || preferredLocale === "ja" || preferredLocale === "ko"
          ? preferredLocale
          : "en",
      public_display_name: typeof publicDisplayName === "string" ? publicDisplayName : null,
    },
    { ignoreDuplicates: true, onConflict: "id" },
  );
}

const registerSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().max(2048).optional(),
});

function getRegisterValidationError(error: z.ZodError) {
  const passwordIssue = error.issues.find((issue) => issue.path[0] === "password");
  if (passwordIssue?.code === "too_small") {
    return "password_too_short";
  }

  const emailIssue = error.issues.find((issue) => issue.path[0] === "email");
  if (emailIssue) {
    return "email_invalid";
  }

  return "invalid_request";
}

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return jsonError("invalid_request", 403);
  }

  const raw = await request.json();
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(getRegisterValidationError(parsed.error));
  }
  const { email, password } = parsed.data;
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
    return jsonError("rate_limited", 429, {
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  if (requireTurnstile) {
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return jsonError("captcha_invalid");
    }
  }

  // Register user with email confirmed immediately
  const result = await registerConfirmedUserWithEmailPassword({ email, password });

  if (isAlreadyRegisteredError(result.error)) {
    return jsonError("account_exists", 409);
  }

  if (result.error) {
    return jsonError("register_failed");
  }

  const userId = result.data?.user?.id;
  if (!userId) {
    return jsonError("register_failed");
  }

  // Return success - frontend will handle the signIn to set browser cookies
  return jsonOk({ ok: true, needsClientLogin: true });
}
