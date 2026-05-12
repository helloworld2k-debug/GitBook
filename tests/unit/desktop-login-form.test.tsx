import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopLoginForm } from "@/app/[locale]/desktop/login/desktop-login-form";

const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

function renderDesktopLoginForm(options: { turnstileSiteKey?: string } = { turnstileSiteKey: "turnstile_site_key" }) {
  render(
    <DesktopLoginForm
      callbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Fdesktop%2Fauthorize%3Fstate%3Dstate-123"
      nextPath="/en/desktop/authorize?state=state-123"
      turnstileSiteKey={options.turnstileSiteKey}
    />,
  );
}

describe("DesktopLoginForm", () => {
  const locationAssign = vi.fn();

  beforeEach(() => {
    createSupabaseBrowserClientMock.mockReset();
    signInWithPasswordMock.mockReset();
    signInWithOAuthMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        remove: vi.fn(),
        render: vi.fn((_: unknown, options: { callback?: (token: string) => void }) => {
          options.callback?.("turnstile-token");
          return "widget-id";
        }),
      },
    });
    locationAssign.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: locationAssign },
    });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200,
    });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
      },
    });
  });

  it("signs in with email through the server login route and returns to the desktop authorize path", async () => {
    renderDesktopLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
        body: JSON.stringify({
          email: "friend@example.com",
          password: "correct-password",
        }),
        method: "POST",
      }));
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(locationAssign).toHaveBeenCalledWith("/en/desktop/authorize?state=state-123");
  });

  it("shows Turnstile when desktop email sign-in is risky", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ error: "captcha_required" }),
      ok: false,
      status: 400,
    });
    renderDesktopLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    expect(await screen.findByTestId("turnstile-placeholder")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Verify that you are human and try again.");

    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/login", expect.objectContaining({
        body: JSON.stringify({
          email: "friend@example.com",
          password: "wrong-password",
          turnstileToken: "turnstile-token",
        }),
        method: "POST",
      }));
    });
  });

  it("starts OAuth with the desktop callback URL", async () => {
    renderDesktopLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://gitbookai.example/auth/callback?next=%2Fen%2Fdesktop%2Fauthorize%3Fstate%3Dstate-123",
        },
      });
    });
  });
});
