const attempts = new Map<string, { count: number; expiresAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRegisterRateLimit(input: { email: string; ip: string | null }) {
  const now = Date.now();
  const key = `${input.ip ?? "unknown"}:${input.email.toLowerCase()}`;
  const current = attempts.get(key);

  if (!current || current.expiresAt <= now) {
    attempts.set(key, { count: 1, expiresAt: now + WINDOW_MS });
    return { ok: true as const };
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      ok: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    };
  }

  attempts.set(key, { ...current, count: current.count + 1 });
  return { ok: true as const };
}
