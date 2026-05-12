import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/login/route";

const mocks = vi.hoisted(() => ({
  checkLoginRisk: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseRouteClient: vi.fn(),
  recordLoginAttempt: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/auth/login-risk", () => ({
  checkLoginRisk: mocks.checkLoginRisk,
  recordLoginAttempt: mocks.recordLoginAttempt,
}));

vi.mock("@/lib/auth/turnstile", () => ({
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseRouteClient,
}));

describe("login route", () => {
  const signInWithPassword = vi.fn();

  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile_secret";
    mocks.checkLoginRisk.mockReset().mockResolvedValue({ captchaRequired: false });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({ admin: true });
    mocks.createSupabaseRouteClient.mockReset().mockResolvedValue({
      auth: {
        signInWithPassword,
      },
    });
    mocks.recordLoginAttempt.mockReset().mockResolvedValue(undefined);
    mocks.verifyTurnstileToken.mockReset().mockResolvedValue({ ok: true });
    signInWithPassword.mockReset().mockResolvedValue({ error: null });
  });

  it("signs in without captcha when the attempt is below risk thresholds", async () => {
    const response = await POST(new Request("https://gitbookai.example/api/auth/login", {
      body: JSON.stringify({
        email: "friend@example.com",
        password: "correct-password",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.checkLoginRisk).toHaveBeenCalledWith({ admin: true }, expect.objectContaining({
      email: "friend@example.com",
      ip: "203.0.113.10",
    }));
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "friend@example.com",
      password: "correct-password",
    });
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith({ admin: true }, expect.objectContaining({
      email: "friend@example.com",
      result: "success",
    }));
  });

  it("requires captcha before Supabase sign-in when the attempt is risky", async () => {
    mocks.checkLoginRisk.mockResolvedValueOnce({ captchaRequired: true });

    const response = await POST(new Request("https://gitbookai.example/api/auth/login", {
      body: JSON.stringify({
        email: "friend@example.com",
        password: "correct-password",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha_required" });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.recordLoginAttempt).not.toHaveBeenCalled();
  });

  it("verifies captcha and continues sign-in for risky attempts", async () => {
    mocks.checkLoginRisk.mockResolvedValueOnce({ captchaRequired: true });

    const response = await POST(new Request("https://gitbookai.example/api/auth/login", {
      body: JSON.stringify({
        email: "friend@example.com",
        password: "correct-password",
        turnstileToken: "ok-token",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith("ok-token", "203.0.113.10");
    expect(signInWithPassword).toHaveBeenCalled();
  });

  it("rejects invalid captcha without Supabase sign-in", async () => {
    mocks.checkLoginRisk.mockResolvedValueOnce({ captchaRequired: true });
    mocks.verifyTurnstileToken.mockResolvedValueOnce({ ok: false, errorCode: "invalid-input-response" });

    const response = await POST(new Request("https://gitbookai.example/api/auth/login", {
      body: JSON.stringify({
        email: "friend@example.com",
        password: "correct-password",
        turnstileToken: "bad-token",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha_invalid" });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("records failed login attempts with a generic invalid credentials response", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: new Error("invalid credentials") });

    const response = await POST(new Request("https://gitbookai.example/api/auth/login", {
      body: JSON.stringify({
        email: "friend@example.com",
        password: "wrong-password",
      }),
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      method: "POST",
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_credentials" });
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith({ admin: true }, expect.objectContaining({
      email: "friend@example.com",
      result: "failure",
    }));
  });
});
