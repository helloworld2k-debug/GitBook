import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DesktopLoginPage, { sanitizeDesktopAuthorizeNextPath } from "@/app/[locale]/desktop/login/page";

vi.mock("@/app/[locale]/desktop/login/desktop-login-form", () => ({
  DesktopLoginForm: ({ callbackUrl, nextPath }: { callbackUrl: string; nextPath: string }) => (
    <div data-testid="desktop-login-form">
      <span data-testid="desktop-login-callback">{callbackUrl}</span>
      <span data-testid="desktop-login-next">{nextPath}</span>
    </div>
  ),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

describe("DesktopLoginPage", () => {
  it("passes a safe desktop authorize next path to the login form", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
    const nextPath = "/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=state-123";
    const page = await DesktopLoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ next: nextPath }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Sign in to GitBook AI" })).toBeInTheDocument();
    expect(screen.getByText("After sign-in, this browser will return to the GitBook AI desktop app.")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-login-next")).toHaveTextContent(nextPath);
    expect(screen.getByTestId("desktop-login-callback")).toHaveTextContent(
      "https://gitbookai.example/auth/callback?next=%2Fen%2Fdesktop%2Fauthorize%3Fdevice_session_id%3Dsession-1%26return_url%3Dgitbookai%253A%252F%252Fauth%252Fcallback%26state%3Dstate-123",
    );
  });

  it("falls back to a harmless desktop authorize path when next is not a desktop authorize path", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
    const page = await DesktopLoginPage({
      params: Promise.resolve({ locale: "ja" }),
      searchParams: Promise.resolve({ next: "/ja/dashboard" }),
    });

    render(page);

    expect(screen.getByTestId("desktop-login-next")).toHaveTextContent("/ja/desktop/authorize");
    expect(screen.getByTestId("desktop-login-callback")).toHaveTextContent(
      "https://gitbookai.example/auth/callback?next=%2Fja%2Fdesktop%2Fauthorize",
    );
  });

  it("shows an authorization error instead of leaving users on a browser 500 page", async () => {
    const page = await DesktopLoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        error: "desktop_authorize_failed",
        next: "/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=state-123",
      }),
    });

    render(page);

    expect(screen.getByRole("alert")).toHaveTextContent("Desktop authorization could not be prepared. Please sign in again.");
  });
});

describe("sanitizeDesktopAuthorizeNextPath", () => {
  it("accepts only same-locale desktop authorize paths", () => {
    expect(sanitizeDesktopAuthorizeNextPath("/en/desktop/authorize?state=abc", "en")).toBe("/en/desktop/authorize?state=abc");
    expect(sanitizeDesktopAuthorizeNextPath("/ja/desktop/authorize?state=abc", "en")).toBe("/en/desktop/authorize");
    expect(sanitizeDesktopAuthorizeNextPath("/en/dashboard", "en")).toBe("/en/desktop/authorize");
    expect(sanitizeDesktopAuthorizeNextPath("https://evil.example/en/desktop/authorize", "en")).toBe("/en/desktop/authorize");
    expect(sanitizeDesktopAuthorizeNextPath(["/en/desktop/authorize?state=abc", "/en/dashboard"], "en")).toBe("/en/desktop/authorize?state=abc");
  });
});
