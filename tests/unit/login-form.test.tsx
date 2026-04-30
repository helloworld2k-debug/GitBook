import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm, type LoginFormMessages } from "@/app/[locale]/login/login-form";

const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

const messages: LoginFormMessages = {
  email: "Email address",
  emailPlaceholder: "you@example.com",
  providerButtons: {
    apple: "Continue with Apple",
    github: "Continue with GitHub",
    google: "Continue with Google",
  },
  magicLink: "Email magic link",
  oauthError: "Could not start sign in.",
  providersLabel: "Other sign-in options",
  sendLink: "Send sign-in link",
  sending: "Sending...",
  submitError: "Could not send the link.",
  success: "Check your email for a secure sign-in link.",
};

function renderLoginForm() {
  render(<LoginForm callbackUrl="https://threefriends.example/auth/callback?next=%2Fen%2Fdonate" messages={messages} />);
}

describe("LoginForm", () => {
  beforeEach(() => {
    createSupabaseBrowserClientMock.mockReset();
    signInWithOtpMock.mockReset();
    signInWithOAuthMock.mockReset();
    signInWithOtpMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        signInWithOAuth: signInWithOAuthMock,
        signInWithOtp: signInWithOtpMock,
      },
    });
  });

  it("submits a magic link with the callback URL", async () => {
    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "friend@example.com",
        options: {
          emailRedirectTo: "https://threefriends.example/auth/callback?next=%2Fen%2Fdonate",
        },
      });
    });
    expect(await screen.findByText("Check your email for a secure sign-in link.")).toBeInTheDocument();
  });

  it("shows an error when magic link submission fails", async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: new Error("rate limited") });
    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send the link.");
  });

  it("starts OAuth sign-in with the selected provider and callback URL", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: "https://threefriends.example/auth/callback?next=%2Fen%2Fdonate",
        },
      });
    });
  });

  it("shows an OAuth error when Supabase cannot start the provider flow", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({ error: new Error("provider disabled") });
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start sign in.");
  });
});
