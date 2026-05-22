import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/register/route";

const mocks = vi.hoisted(() => ({
  checkRegisterRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  registerWithEmailPassword: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  validateRequestOrigin: () => true,
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
    delete process.env.TEMP_DISABLE_EMAIL_CONFIRMATION;
    process.env.TURNSTILE_SECRET_KEY = "turnstile_secret";
    mocks.checkRegisterRateLimit.mockReset().mockResolvedValue({ ok: true });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }),
        },
      },
    });
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

  it("returns a specific error when the registration password is shorter than 8 characters", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/register", {
        body: JSON.stringify({
          email: "new@example.com",
          password: "short",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "password_too_short" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
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
      expect.objectContaining({ admin: true }),
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

  it("creates a confirmed user through the admin API when temporary email confirmation bypass is enabled", async () => {
    process.env.TEMP_DISABLE_EMAIL_CONFIRMATION = "true";
    const adminClient = {
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }),
        },
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);

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
    await expect(response.json()).resolves.toEqual({ emailConfirmationBypassed: true, ok: true });
    expect(mocks.registerWithEmailPassword).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      email_confirm: true,
      password: "new-password",
      user_metadata: {
        source: "register_form",
      },
    });
  });

  it("does not create a confirmed user when registration is rate-limited", async () => {
    process.env.TEMP_DISABLE_EMAIL_CONFIRMATION = "true";
    const adminClient = {
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }),
        },
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);
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
    expect(adminClient.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("treats an existing email from temporary confirmed registration as a safe success", async () => {
    process.env.TEMP_DISABLE_EMAIL_CONFIRMATION = "true";
    const adminClient = {
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { code: "email_exists", message: "User already registered", status: 422 },
          }),
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [
                {
                  id: "existing-user-id",
                  email: "existing@example.com",
                  email_confirmed_at: "2026-05-18T12:00:00.000Z",
                },
              ],
            },
            error: null,
          }),
          updateUserById: vi.fn(),
        },
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);

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

  it("confirms and updates the password for an existing unverified user in temporary registration mode", async () => {
    process.env.TEMP_DISABLE_EMAIL_CONFIRMATION = "true";
    const adminClient = {
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { code: "email_exists", message: "User already registered", status: 422 },
          }),
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [
                {
                  id: "existing-user-id",
                  email: "existing@example.com",
                  email_confirmed_at: null,
                },
              ],
            },
            error: null,
          }),
          updateUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "existing-user-id" } },
            error: null,
          }),
        },
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);

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
    await expect(response.json()).resolves.toEqual({ emailConfirmationBypassed: true, ok: true });
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith("existing-user-id", {
      email_confirm: true,
      password: "new-password",
      user_metadata: {
        source: "register_form",
      },
    });
  });

  it("rejects non-duplicate temporary confirmed registration failures", async () => {
    process.env.TEMP_DISABLE_EMAIL_CONFIRMATION = "true";
    const adminClient = {
      admin: true,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { code: "weak_password", message: "Password should be stronger", status: 422 },
          }),
        },
      },
    };
    mocks.createSupabaseAdminClient.mockReturnValue(adminClient);

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
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
  });

  it("returns an explicit existing account error when signup reports an already registered email", async () => {
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

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "account_exists" });
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
          password: "longenoughpassword",
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
