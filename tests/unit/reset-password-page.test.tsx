import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "@/app/[locale]/reset-password/page";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Three Friends</header>,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      confirmPassword: "Confirm password",
      error: "Could not update your password.",
      newPassword: "New password",
      submit: "Update password",
      success: "Password updated. You can now sign in.",
      title: "Set a new password",
    };

    return messages[key] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

describe("ResetPasswordPage", () => {
  it("renders the new password form", async () => {
    const page = await ResetPasswordPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
  });
});
