import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContributionsPage from "@/app/[locale]/contributions/page";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>GitBook AI</header>,
}));

vi.mock("@/components/donation-tier-card", () => ({
  DonationTierCard: ({ label }: { label: string }) => <div>{label}</div>,
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
  it("shows a warning banner when Dodo checkout is cancelled", async () => {
    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ payment: "cancelled" }),
      } as {
        params: Promise<{ locale: string }>;
        searchParams: Promise<{ payment: string }>;
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checkout was cancelled. You can review the support tiers and try again when ready.",
    );
  });
});
