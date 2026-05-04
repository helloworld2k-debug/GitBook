import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";
import { sanitizeNextPath } from "@/lib/auth/guards";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const exchangeCodeForSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

describe("auth redirect safety", () => {
  it("preserves safe relative next paths", () => {
    expect(sanitizeNextPath("/ja/contributions?tier=yearly", "/en/dashboard")).toBe("/ja/contributions?tier=yearly");
  });

  it("uses the first safe path when next is repeated", () => {
    expect(sanitizeNextPath(["/ko/dashboard", "https://evil.example/take"], "/en/dashboard")).toBe("/ko/dashboard");
  });

  it("builds locale dashboard defaults", () => {
    expect(sanitizeNextPath(null, "/ja/dashboard")).toBe("/ja/dashboard");
    expect(sanitizeNextPath(undefined, "/ko/dashboard")).toBe("/ko/dashboard");
  });

  it("falls back when the first repeated next value is unsafe", () => {
    expect(sanitizeNextPath(["https://evil.example/take", "/ko/dashboard"], "/en/dashboard")).toBe("/en/dashboard");
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
    createSupabaseServerClientMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
      },
    });
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
  });

  it("exchanges the code and redirects to a safe next path", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fja%2Fcontributions%3Ftier%3Dyearly"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://gitbookai.example/ja/contributions?tier=yearly");
  });

  it("falls back to the English dashboard for external next paths", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=https%3A%2F%2Fevil.example%2Ftake"),
    );

    expect(response.headers.get("location")).toBe("https://gitbookai.example/en/dashboard");
  });

  it("falls back to a localized dashboard when next has a supported locale but is otherwise unsafe", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fja%2F..%5Cdashboard"),
    );

    expect(response.headers.get("location")).toBe("https://gitbookai.example/ja/dashboard");
  });

  it("redirects reset password callbacks to the localized reset password page", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/auth/callback?code=abc123&next=%2Fja%2Freset-password"),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("https://gitbookai.example/ja/reset-password");
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
      new Request("https://gitbookai.example/auth/callback?code=bad-code&next=%2Fko%2Fdashboard"),
    );

    expect(response.headers.get("location")).toBe(
      "https://gitbookai.example/ko/login?error=callback&next=%2Fko%2Fdashboard",
    );
  });
});
