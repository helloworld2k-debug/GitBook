import { jsonError, jsonOk } from "@/lib/api/responses";
import { checkRegisterRateLimit } from "@/lib/auth/register-rate-limit";
import { registerWithEmailPassword } from "@/lib/auth/register";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";

type RegisterRequestBody = {
  callbackUrl?: string;
  email?: string;
  password?: string;
  turnstileToken?: string;
};

function getIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() ?? null;
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

  if (!turnstileToken) {
    return jsonError("captcha_required");
  }

  const ip = getIpAddress(request);
  const limit = checkRegisterRateLimit({ email, ip });

  if (!limit.ok) {
    return jsonError(
      "rate_limited",
      429,
      {
        headers: { "retry-after": String(limit.retryAfterSeconds) },
      },
    );
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);

  if (!turnstile.ok) {
    return jsonError("captcha_invalid");
  }

  const result = await registerWithEmailPassword({
    callbackUrl,
    email,
    password,
  });

  if (result.error) {
    return jsonError("register_failed");
  }

  return jsonOk({ ok: true });
}
