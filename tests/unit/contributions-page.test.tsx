import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContributionsPage from "@/app/[locale]/contributions/page";

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>GitBook AI</header>,
}));

vi.mock("@/components/donation-tier-card", () => ({
  DonationTierCard: ({ isAuthenticated, label, tier }: { isAuthenticated: boolean; label: string; tier: { amount: number; compareAtAmount: number | null } }) => (
    <div>
      {label} {tier.amount} {tier.compareAtAmount ?? "no-original"} {isAuthenticated ? "authenticated" : "anonymous"}
    </div>
  ),
}));

vi.mock("@/components/payment-status-banner", () => ({
  PaymentStatusBanner: ({ message }: { message: string }) => <div role="status">{message}</div>,
}));

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      title: "Contribute to GitBook AI",
      subtitle: "Choose a one-time contribution.",
      checkoutDodo: "Contribute now",
      loginToContribute: "Sign in to contribute",
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
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset().mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  amount: 900,
                  code: "monthly",
                  compare_at_amount: null,
                  currency: "usd",
                  description: "Monthly support",
                  id: "tier-monthly",
                  label: "Monthly Support",
                  sort_order: 1,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
  });

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

  it("passes anonymous auth state to contribution cards", async () => {
    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Monthly Support 900 no-original anonymous")).toBeInTheDocument();
  });

  it("passes signed-in auth state to contribution cards", async () => {
    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  amount: 2430,
                  code: "quarterly",
                  compare_at_amount: 2700,
                  currency: "usd",
                  description: "Quarterly support",
                  id: "tier-quarterly",
                  label: "Quarterly Support",
                  sort_order: 2,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Quarterly Support 2430 2700 authenticated")).toBeInTheDocument();
  });

  it("still renders tiers when production has not migrated original prices yet", async () => {
    const select = vi
      .fn()
      .mockReturnValueOnce({
        eq: () => ({
          order: async () => ({
            data: null,
            error: { code: "42703", message: "column donation_tiers.compare_at_amount does not exist" },
          }),
        }),
      })
      .mockReturnValueOnce({
        eq: () => ({
          order: async () => ({
            data: [
              {
                amount: 8640,
                code: "yearly",
                currency: "usd",
                description: "Yearly support",
                id: "tier-yearly",
                label: "Yearly Support",
                sort_order: 3,
              },
            ],
            error: null,
          }),
        }),
      });
    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from: () => ({ select }),
    });

    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Yearly Support 8640 10800 anonymous")).toBeInTheDocument();
  });

  it("renders configured tiers when the production database query fails", async () => {
    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: null,
              error: { message: "database unavailable" },
            }),
          }),
        }),
      }),
    });

    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Monthly Support 900 no-original anonymous")).toBeInTheDocument();
    expect(screen.getByText("Quarterly Support 2430 2700 anonymous")).toBeInTheDocument();
    expect(screen.getByText("Yearly Support 8640 10800 anonymous")).toBeInTheDocument();
  });

  it("renders configured tiers when auth lookup fails", async () => {
    mocks.createSupabaseServerClient.mockResolvedValueOnce({
      auth: {
        getUser: async () => {
          throw new Error("auth unavailable");
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: null,
              error: { message: "database unavailable" },
            }),
          }),
        }),
      }),
    });

    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Monthly Support 900 no-original anonymous")).toBeInTheDocument();
  });

  it("renders configured tiers when Supabase server configuration is missing", async () => {
    mocks.createSupabaseServerClient.mockRejectedValueOnce(
      new Error("Missing NEXT_PUBLIC_SUPABASE_URL. Set it to your Supabase project URL."),
    );

    render(
      await ContributionsPage({
        params: Promise.resolve({ locale: "en" }),
      } as {
        params: Promise<{ locale: string }>;
      }),
    );

    expect(screen.getByText("Monthly Support 900 no-original anonymous")).toBeInTheDocument();
    expect(screen.getByText("Quarterly Support 2430 2700 anonymous")).toBeInTheDocument();
    expect(screen.getByText("Yearly Support 8640 10800 anonymous")).toBeInTheDocument();
  });
});
