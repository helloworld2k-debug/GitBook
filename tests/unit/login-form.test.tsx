import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm, type LoginFormMessages } from "@/app/[locale]/login/login-form";

const createSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const signInWithOAuthMock = vi.hoisted(() => vi.fn());
const resetPasswordForEmailMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: createSupabaseBrowserClientMock,
}));

const messages: LoginFormMessages = {
  confirmPassword: "Confirm password",
  confirmPasswordPlaceholder: "Repeat your password",
  createAccount: "Create account",
  email: "Email address",
  emailPlaceholder: "you@example.com",
  humanVerificationError: "Verify that you are human and try again.",
  humanVerificationLabel: "Human verification",
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
  registrationSuccess: "If this is a new account, check your email to verify it. If this email is already registered, sign in or reset your password.",
  registrationRateLimited: "Too many registration attempts. Please try again later.",
  signInSubmit: "Sign in with email",
  signInTab: "Sign in",
  signingIn: "Signing in...",
  signingUp: "Creating account...",
  signInError: "Could not sign in. Check your email and password.",
  signUpError: "Could not create the account. Check your email and password.",
  sending: "Sending...",
  title: "Email and password",
};

function renderLoginForm(options: { turnstileSiteKey?: string } = { turnstileSiteKey: "turnstile_site_key" }) {
  render(
    <LoginForm
      callbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions"
      messages={messages}
      nextPath="/en/contributions"
      passwordResetCallbackUrl="https://gitbookai.example/auth/callback?next=%2Fen%2Freset-password"
      turnstileSiteKey={options.turnstileSiteKey}
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
    fetchMock.mockReset();
    locationAssign.mockReset();
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
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: locationAssign },
    });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signUpMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200,
    });
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

  it("disables the password submit button while a sign-in request is pending", async () => {
    let resolveSignIn: ((value: { error: null }) => void) | null = null;
    signInWithPasswordMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    renderLoginForm();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "friend@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();

    resolveSignIn?.({ error: null });
    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/en/contributions");
    });
  });

  it("registers with email and password and requests email verification", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByTestId("turnstile-placeholder")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByRole("status")).toHaveTextContent("If this is a new account, check your email to verify it. If this email is already registered, sign in or reset your password.");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("registers without a Turnstile token when captcha is not configured", async () => {
    renderLoginForm({ turnstileSiteKey: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.queryByTestId("turnstile-placeholder")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({
        body: JSON.stringify({
          callbackUrl: "https://gitbookai.example/auth/callback?next=%2Fen%2Fcontributions",
          email: "new@example.com",
          password: "new-password",
        }),
        method: "POST",
      }));
    });
    expect(await screen.findByRole("status")).toHaveTextContent("If this is a new account, check your email to verify it. If this email is already registered, sign in or reset your password.");
  });

  it("does not register when passwords do not match", async () => {
    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a human verification error when no Turnstile token is available", async () => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        remove: vi.fn(),
        render: vi.fn(() => "widget-id"),
      },
    });

    renderLoginForm();

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Verify that you are human and try again.");
    expect(fetchMock).not.toHaveBeenCalled();
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
