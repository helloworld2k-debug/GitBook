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
      continueWithProvider: "Continue with {provider}",
      email: "Email address",
      emailPlaceholder: "you@example.com",
      eyebrow: "Account access",
      github: "GitHub",
      google: "Google",
      magicLink: "Email magic link",
      oauthError: "Could not start sign in.",
      privacyNote: "We only use your account for donations and certificates.",
      providersLabel: "Other sign-in options",
      sendLink: "Send sign-in link",
      sending: "Sending...",
      submitError: "Could not send the link.",
      subtitle: "Sign in or register to continue.",
      success: "Check your email for a secure sign-in link.",
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
      "https://threefriends.example/auth/callback?next=%2Fen%2Fdashboard",
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
});
