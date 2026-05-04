type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; errorCode: string | null };

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export async function verifyTurnstileToken(token: string, remoteIp: string | null): Promise<TurnstileVerificationResult> {
  const secret = readRequiredEnv("TURNSTILE_SECRET_KEY", "your Cloudflare Turnstile secret key");
  const body = new URLSearchParams({
    response: token,
    secret,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    return { ok: false, errorCode: "verification-request-failed" };
  }

  const result = await response.json() as {
    "error-codes"?: string[];
    success?: boolean;
  };

  if (!result.success) {
    return { ok: false, errorCode: result["error-codes"]?.[0] ?? null };
  }

  return { ok: true };
}
