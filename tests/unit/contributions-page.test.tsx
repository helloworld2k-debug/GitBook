import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContributionsPage from "@/app/[locale]/contributions/page";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>GitBook AI</header>,
}));

vi.mock("@/components/donation-tier-card", () => ({
  DonationTierCard: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("@/components/payment-status-banner", () => ({
  PaymentStatusBanner: ({ message }: { message: string }) => <div role="status">{message}</div>,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      title: "Contribute to GitBook AI",
      subtitle: "Choose a one-time contribution.",
      checkoutDodo: "Contribute now",
      "tiers.monthly": "Monthly Support",
      "tiers.quarterly": "Quarterly Support",
      "tiers.yearly": "Yearly Support",
      oneTimeNote: "One-time support.",
      paymentNote: "Secure checkout with Dodo Payments.",
      cancelled: "Checkout was cancelled. You can review the support tiers and try again when ready.",
    };

    return messages[key] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

describe("ContributionsPage", () => {
  it("passes the cancelled checkout copy to the client-side status banner", async () => {
    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checkout was cancelled. You can review the support tiers and try again when ready.",
    );
  });
});
