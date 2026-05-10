import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/register/route";

const mocks = vi.hoisted(() => ({
  checkRegisterRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  registerWithEmailPassword: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/auth/register-rate-limit", () => ({
  checkRegisterRateLimit: mocks.checkRegisterRateLimit,
}));

vi.mock("@/lib/auth/register", () => ({
  registerWithEmailPassword: mocks.registerWithEmailPassword,
}));

vi.mock("@/lib/auth/turnstile", () => ({
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("register route", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile_secret";
    mocks.checkRegisterRateLimit.mockReset().mockResolvedValue({ ok: true });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({ admin: true });
    mocks.registerWithEmailPassword.mockReset().mockResolvedValue({ error: null });
    mocks.verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true });
  });

  it("creates a user without Turnstile when captcha is not configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(mocks.registerWithEmailPassword).toHaveBeenCalledWith({
      callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
      email: "new@example.com",
      password: "new-password",
    });
  });

  it("rejects registration when the Turnstile token is missing", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha_required" });
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(mocks.registerWithEmailPassword).not.toHaveBeenCalled();
  });

  it("rejects registration when Turnstile verification fails", async () => {
    mocks.verifyTurnstileToken.mockResolvedValueOnce({ ok: false, errorCode: "invalid-input-response" });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
          turnstileToken: "bad-token",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha_invalid" });
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith("bad-token", "203.0.113.10");
    expect(mocks.registerWithEmailPassword).not.toHaveBeenCalled();
  });

  it("rate-limits abusive registration attempts before creating a user", async () => {
    mocks.checkRegisterRateLimit.mockReturnValueOnce({ ok: false, retryAfterSeconds: 60 });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
          turnstileToken: "ok-token",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.checkRegisterRateLimit).toHaveBeenCalledWith(
      { admin: true },
      expect.objectContaining({
        email: "new@example.com",
        ip: "203.0.113.10",
      }),
    );
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(mocks.registerWithEmailPassword).not.toHaveBeenCalled();
  });

  it("creates a new unconfirmed user through the signup flow after passing Turnstile verification", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
          turnstileToken: "ok-token",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.registerWithEmailPassword).toHaveBeenCalledWith({
      callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
      email: "new@example.com",
      password: "new-password",
    });
  });

  it("treats an already registered email as a safe successful registration response", async () => {
    mocks.registerWithEmailPassword.mockResolvedValueOnce({
      error: {
        code: "user_already_exists",
        message: "User already registered",
        status: 422,
      },
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "existing@example.com",
          password: "new-password",
          turnstileToken: "ok-token",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("still rejects non-duplicate signup failures", async () => {
    mocks.registerWithEmailPassword.mockResolvedValueOnce({
      error: {
        code: "weak_password",
        message: "Password should be at least 6 characters",
        status: 422,
      },
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "short",
          turnstileToken: "ok-token",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "register_failed" });
  });
});
