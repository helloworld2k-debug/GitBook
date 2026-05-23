import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";
import { sanitizeNextPath } from "@/lib/auth/guards";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const exchangeCodeForSessionMock = vi.hoisted(() => vi.fn());
const verifyOtpMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      verifyOtp: verifyOtpMock,
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

describe("auth redirect safety", () => {
  it("preserves safe relative next paths", () => {
    expect(sanitizeNextPath("/zh/contributions?tier=yearly", "/en/dashboard")).toBe("/zh/contributions?tier=yearly");
  });

  it("uses the first safe path when next is repeated", () => {
    expect(sanitizeNextPath(["/en/dashboard", "https://evil.example/take"], "/en/dashboard")).toBe("/en/dashboard");
  });

  it("builds locale dashboard defaults", () => {
    expect(sanitizeNextPath(null, "/zh/dashboard")).toBe("/zh/dashboard");
    expect(sanitizeNextPath(undefined, "/en/dashboard")).toBe("/en/dashboard");
  });

  it("falls back when the first repeated next value is unsafe", () => {
    expect(sanitizeNextPath(["https://evil.example/take", "/en/dashboard"], "/en/dashboard")).toBe("/en/dashboard");
  });

  it("rejects external and protocol-relative next paths", () => {
    expect(sanitizeNextPath("https://evil.example/phish", "/en/dashboard")).toBe("/en/dashboard");
    expect(sanitizeNextPath("//evil.example/phish", "/en/dashboard")).toBe("/en/dashboard");
  });

  it("rejects unsafe relative paths", () => {
    expect(sanitizeNextPath("dashboard", "/en/dashboard")).toBe("/en/dashboard");
    expect(sanitizeNextPath("/api/checkout/stripe", "/en/dashboard")).toBe("/en/dashboard");
    expect(sanitizeNextPath("/_next/static/chunk.js", "/en/dashboard")).toBe("/en/dashboard");
  });
});

describe("auth callback route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const updateQuery = {
      eq: vi.fn(() => updateQuery),
      update: vi.fn(() => updateQuery),
    };
    createSupabaseAdminClientMock.mockReset().mockReturnValue({
      from: vi.fn(() => updateQuery),
    });
    createSupabaseServerClientMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    verifyOtpMock.mockReset();
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        verifyOtp: verifyOtpMock,
      },
    });
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    verifyOtpMock.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
  });

  it("exchanges the code and redirects to a safe next path", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fzh%2Fcontributions%3Ftier%3Dyearly"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gitbookai.example/zh/contributions?tier=yearly");
  });

  it("falls back to the English dashboard for external next paths", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=https%3A%2F%2Fevil.example%2Ftake"),
    );

    expect(response.headers.get("location")).toBe("https://gitbookai.example/en/dashboard");
  });

  it("falls back to a localized dashboard when next has a supported locale but is otherwise unsafe", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fzh%2F..%5Cdashboard"),
    );

    expect(response.headers.get("location")).toBe("https://gitbookai.example/zh/dashboard");
  });

  it("redirects reset password callbacks to the localized reset password page", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fzh%2Freset-password"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("https://gitbookai.example/zh/reset-password");
  });

  it("verifies signup email links that use token_hash and redirects to the requested page", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?token_hash=hash123&type=signup&next=%2Fen%2Fcontributions"),
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash123", type: "signup" });
    expect(response.headers.get("location")).toBe("https://gitbookai.example/en/dashboard?welcome=verified");
  });

  it("verifies invite email links and redirects invited users to set a password", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?token_hash=invite-hash&type=invite&next=%2Fzh%2Fdashboard"),
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "invite-hash", type: "invite" });
    expect(response.headers.get("location")).toBe("https://gitbookai.example/zh/reset-password");
  });

  it("redirects invite links to login with an error when Supabase rejects the token", async () => {
    verifyOtpMock.mockResolvedValueOnce({ data: { session: null }, error: new Error("expired invite") });

    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?token_hash=bad-invite&type=invite&next=%2Fzh%2Fdashboard"),
    );

    expect(response.headers.get("location")).toBe("https://gitbookai.example/zh/login?error=callback&next=%2Fzh%2Fdashboard");
  });

  it("redirects to login with an error when the code is missing", async () => {
    const response = await GET(new Request("https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions"));

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gitbookai.example/en/login?error=missing-code&next=%2Fen%2Fcontributions");
  });

  it("redirects to login with an error when Supabase rejects the code", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ data: { session: null }, error: new Error("expired") });

    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=bad-code&next=%2Fen%2Fdashboard"),
    );

    expect(response.headers.get("location")).toBe(
      "https://gitbookai.example/en/login?error=callback&next=%2Fen%2Fdashboard",
    );
  });
});
