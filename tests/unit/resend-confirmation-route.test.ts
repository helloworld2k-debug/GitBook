import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/resend-confirmation/route";

const mocks = vi.hoisted(() => ({
  checkConfirmationResendRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth/confirmation-resend-rate-limit", () => ({
  checkConfirmationResendRateLimit: mocks.checkConfirmationResendRateLimit,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("resend confirmation route", () => {
  const resend = vi.fn();

  beforeEach(() => {
    resend.mockReset().mockResolvedValue({ data: {}, error: null });
    mocks.checkConfirmationResendRateLimit.mockReset().mockResolvedValue({ ok: true });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({
      auth: {
        resend,
      },
      from: vi.fn(),
    });
  });

  it("resends signup confirmation through Supabase after passing rate limits", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/auth/resend-confirmation", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdashboard",
          email: "New@Example.com",
        }),
        headers: { "content-type": "application/json", "user-agent": "Vitest", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.checkConfirmationResendRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: "New@Example.com",
        ip: "203.0.113.10",
        userAgent: "Vitest",
      }),
    );
    expect(resend).toHaveBeenCalledWith({
      email: "New@Example.com",
      options: {
        emailRedirectTo: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdashboard",
      },
      type: "signup",
    });
  });

  it("rate-limits repeated resend requests before calling Supabase", async () => {
    mocks.checkConfirmationResendRateLimit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/resend-confirmation", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdashboard",
          email: "new@example.com",
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(resend).not.toHaveBeenCalled();
  });

  it("returns a generic success when Supabase rejects resend so account existence is not exposed", async () => {
    resend.mockResolvedValueOnce({ data: null, error: new Error("User not found") });

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/resend-confirmation", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdashboard",
          email: "missing@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns a generic success when Supabase resend throws", async () => {
    resend.mockRejectedValueOnce(new Error("network failure"));

    const response = await POST(
      new Request("https://gitbookai.example/api/auth/resend-confirmation", {
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdashboard",
          email: "missing@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects unsafe callback URLs", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/auth/resend-confirmation", {
        body: JSON.stringify({
          callbackUrl: "https://evil.example/auth/callback?next=%2Fen%2Fdashboard",
          email: "new@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    expect(resend).not.toHaveBeenCalled();
  });
});
