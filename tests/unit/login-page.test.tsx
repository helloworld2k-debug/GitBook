import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/[locale]/login/page";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Three Friends</header>,
}));

vi.mock("@/app/[locale]/login/login-form", () => ({
  LoginForm: ({ callbackUrl }: { callbackUrl: string }) => <div data-testid="login-form">{callbackUrl}</div>,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, string>) => {
    const messages: Record<string, string> = {
      apple: "Apple",
      callbackError: "The sign-in link could not be verified.",
      confirmPassword: "Confirm password",
      confirmPasswordPlaceholder: "Repeat your password",
      continueWithProvider: "Continue with {provider}",
      createAccount: "Create account",
      email: "Email address",
      emailPlaceholder: "you@example.com",
      eyebrow: "Account access",
      formTitle: "Email and password",
      github: "GitHub",
      google: "Google",
      oauthError: "Could not start sign in.",
      password: "Password",
      passwordMismatch: "Passwords do not match.",
      passwordPlaceholder: "Enter your password",
      passwordResetBack: "Back to sign in",
      passwordResetComplete: "Password updated. You can now sign in.",
      passwordResetError: "Could not send the reset email.",
      passwordResetMode: "Forgot password?",
      passwordResetSent: "Check your email for a password reset link.",
      passwordResetSubmit: "Send reset email",
      passwordResetTitle: "Reset password",
      privacyNote: "We only use your account for donations and certificates.",
      providersLabel: "Other sign-in options",
      registerTab: "Register",
      registrationSuccess: "Check your email to verify your account before signing in.",
      sending: "Sending...",
      signInError: "Could not sign in.",
      signInSubmit: "Sign in with email",
      signInTab: "Sign in",
      signingIn: "Signing in...",
      signingUp: "Creating account...",
      signUpError: "Could not create the account.",
      subtitle: "Sign in or register to continue.",
      title: "Sign in or create your account",
    };

    if (key === "continueWithProvider" && !values?.provider) {
      throw new Error("provider value is required");
    }

    if (key === "continueWithProvider") {
      return messages[key].replace("{provider}", values?.provider ?? "");
    }

    return messages[key] ?? key;
  }),
}));

describe("LoginPage", () => {
  it("renders a localized login page with a safe callback next path", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    const page = await LoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ next: "/en/donate?tier=yearly" }),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Sign in or create your account" })).toBeInTheDocument();
    expect(screen.getByTestId("login-form")).toHaveTextContent(
      "https://threefriends.example/auth/callback?next=%2Fen%2Fdonate%3Ftier%3Dyearly",
    );
  });

  it("falls back to the default dashboard when next is external", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    const page = await LoginPage({
      params: Promise.resolve({ locale: "ja" }),
      searchParams: Promise.resolve({ next: "https://evil.example/take" }),
    });

    render(page);

    expect(screen.getByTestId("login-form")).toHaveTextContent(
      "https://threefriends.example/auth/callback?next=%2Fja%2Fdashboard",
    );
  });

  it("uses the current locale dashboard when next is absent", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    const page = await LoginPage({
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByTestId("login-form")).toHaveTextContent(
      "https://threefriends.example/auth/callback?next=%2Fko%2Fdashboard",
    );
  });

  it("uses the first safe value when next is repeated", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    const page = await LoginPage({
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({ next: ["/ko/dashboard", "https://evil.example/take"] }),
    });

    render(page);

    expect(screen.getByTestId("login-form")).toHaveTextContent(
      "https://threefriends.example/auth/callback?next=%2Fko%2Fdashboard",
    );
  });

  it("shows a callback error status", async () => {
    const page = await LoginPage({
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({ error: "callback", next: "/ko/dashboard" }),
    });

    render(page);

    expect(screen.getByRole("alert")).toHaveTextContent("The sign-in link could not be verified.");
  });

  it("shows a password reset completion status", async () => {
    const page = await LoginPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ password: "reset" }),
    });

    render(page);

    expect(screen.getByRole("status")).toHaveTextContent("Password updated. You can now sign in.");
  });
});
