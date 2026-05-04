import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!turnstileToken) {
    return NextResponse.json({ error: "captcha_required" }, { status: 400 });
  }

  const ip = getIpAddress(request);
  const limit = checkRegisterRateLimit({ email, ip });

  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        headers: { "retry-after": String(limit.retryAfterSeconds) },
        status: 429,
      },
    );
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);

  if (!turnstile.ok) {
    return NextResponse.json({ error: "captcha_invalid" }, { status: 400 });
  }

  const result = await registerWithEmailPassword({
    callbackUrl,
    email,
    password,
  });

  if (result.error) {
    return NextResponse.json({ error: "register_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
