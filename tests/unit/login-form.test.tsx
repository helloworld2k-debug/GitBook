import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm, type LoginFormMessages } from "@/app/[locale]/login/login-form";

const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

const messages: LoginFormMessages = {
  confirmPassword: "Confirm password",
  confirmPasswordPlaceholder: "Repeat your password",
  createAccount: "Create account",
  email: "Email address",
  emailPlaceholder: "you@example.com",
  oauthError: "Could not start sign in.",
  password: "Password",
  passwordMismatch: "Passwords do not match.",
  passwordPlaceholder: "Enter your password",
  passwordResetBack: "Back to sign in",
  passwordResetError: "Could not send the reset email.",
  passwordResetMode: "Forgot password?",
  passwordResetSent: "Check your email for a password reset link.",
  passwordResetSubmit: "Send reset email",
  passwordResetTitle: "Reset password",
  providerButtons: {
    github: "Continue with GitHub",
    google: "Continue with Google",
  },
  providersLabel: "Quick sign-in options",
  registerTab: "Register",
  registrationSuccess: "Check your email to verify your account before signing in.",
  signInSubmit: "Sign in with email",
  signInTab: "Sign in",
  signingIn: "Signing in...",
  signingUp: "Creating account...",
  signInError: "Could not sign in. Check your email and password.",
  signUpError: "Could not create the account. Check your email and password.",
  sending: "Sending...",
  title: "Email and password",
};

function renderLoginForm() {
  render(
    <LoginForm
      callbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions"
      messages={messages}
      nextPath="/en/contributions"
      passwordResetCallbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Freset-password"
    />,
  );
}

describe("LoginForm", () => {
  const locationAssign = vi.fn();

  beforeEach(() => {
    createSupabaseBrowserClientMock.mockReset();
    signInWithPasswordMock.mockReset();
    signUpMock.mockReset();
    signInWithOAuthMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    locationAssign.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: locationAssign },
    });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signUpMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        resetPasswordForEmail: resetPasswordForEmailMock,
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
      },
    });
  });

  it("signs in with email and password", async () => {
    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "friend@example.com",
        password: "correct-password",
      });
    });
    expect(locationAssign).toHaveBeenCalledWith("/en/contributions");
  });

  it("shows an error when password sign-in fails", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ error: new Error("invalid credentials") });
    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign in. Check your email and password.");
  });

  it("registers with email and password and requests email verification", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "new-password",
        options: {
          emailRedirectTo: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
        },
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email to verify your account before signing in.");
  });

  it("does not register when passwords do not match", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows Google and GitHub quick sign-in options without Apple", () => {
    renderLoginForm();

    const providers = screen.getByRole("group", { name: "Quick sign-in options" });
    expect(providers).toBeInTheDocument();
    expect(within(providers).getAllByRole("button")).toHaveLength(2);
    expect(within(providers).getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(within(providers).getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(within(providers).queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    const registrationProviders = screen.getByRole("group", { name: "Quick sign-in options" });
    expect(within(registrationProviders).getAllByRole("button")).toHaveLength(2);
    expect(within(registrationProviders).getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(within(registrationProviders).getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(within(registrationProviders).queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();
  });

  it("starts OAuth sign-in with the selected provider and callback URL", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
        },
      });
    });
  });

  it("shows an OAuth error when Supabase cannot start the provider flow", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({ error: new Error("provider disabled") });
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start sign in.");
  });

  it("sends a password reset email with the callback URL", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith("friend@example.com", {
        redirectTo: "https://gitbookai.example/auth/callback?next=%2Fen%2Freset-password",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email for a password reset link.");
  });
});
