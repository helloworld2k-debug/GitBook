import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopLoginForm } from "@/app/[locale]/desktop/login/desktop-login-form";

const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

function renderDesktopLoginForm() {
  render(
    <DesktopLoginForm
      callbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Fdesktop%2Fauthorize%3Fstate%3Dstate-123"
      nextPath="/en/desktop/authorize?state=state-123"
    />,
  );
}

describe("DesktopLoginForm", () => {
  const locationAssign = vi.fn();

  beforeEach(() => {
    createSupabaseBrowserClientMock.mockReset();
    signInWithPasswordMock.mockReset();
    signInWithOAuthMock.mockReset();
    locationAssign.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: locationAssign },
    });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
      },
    });
  });

  it("signs in with email and returns to the desktop authorize path", async () => {
    renderDesktopLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "friend@example.com",
        password: "correct-password",
      });
    });
    expect(locationAssign).toHaveBeenCalledWith("/en/desktop/authorize?state=state-123");
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
