import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminContributionPricingPage from "@/app/[locale]/admin/contribution-pricing/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ currentLocale }: { currentLocale: string }) => <div>Language {currentLocale}</div>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(() => "en"),
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      "admin.contributionPricing.eyebrow": "Admin",
      "admin.contributionPricing.title": "Contribution pricing",
      "admin.contributionPricing.description": "Manage Contributions page prices, discounts, and support tier copy.",
      "admin.contributionPricing.tiersTitle": "Development support tiers",
      "admin.contributionPricing.tiersDescription": "Update the prices and copy shown on the Contributions page.",
      "admin.contributionPricing.tierLabel": "Tier label",
      "admin.contributionPricing.tierDescription": "Description",
      "admin.contributionPricing.tierPrice": "Price",
      "admin.contributionPricing.tierDiscountPercent": "Discount Applicable (%)",
      "admin.contributionPricing.status": "Status",
      "admin.contributionPricing.tierActive": "Active",
      "admin.contributionPricing.tierInactive": "Inactive",
      "admin.contributionPricing.tierStatusHelp": "Inactive tiers are hidden from the Contributions page.",
      "admin.contributionPricing.save": "Save tier",
      "admin.contributionPricing.tierSaved": "Tier saved",
      "admin.contributionPricing.paymentSettingsTitle": "Dodo payment product IDs",
      "admin.contributionPricing.paymentSettingsDescription": "Save test and live Dodo product IDs without redeploying. Enabling both is normal: the app chooses one environment at runtime.",
      "admin.contributionPricing.paymentSettingsRuntimeTitle": "How checkout chooses a mode",
      "admin.contributionPricing.paymentSettingsRuntimeBody": "Production checkout uses live IDs when DODO_PAYMENTS_ENV is live. Test checkout uses test IDs only when the app is running in test mode.",
      "admin.contributionPricing.paymentEnvironmentTest": "Test mode",
      "admin.contributionPricing.paymentEnvironmentLive": "Live mode",
      "admin.contributionPricing.paymentEnvironmentTestHelp": "Use these IDs for local or preview testing.",
      "admin.contributionPricing.paymentEnvironmentLiveHelp": "Use these IDs for real customer payments.",
      "admin.contributionPricing.paymentProductId": "Product ID",
      "admin.contributionPricing.paymentProductHelp": "Use the Dodo product ID for this tier and mode.",
      "admin.contributionPricing.paymentProductEnabled": "Enabled",
      "admin.contributionPricing.paymentProductDisabled": "Disabled",
      "admin.contributionPricing.paymentProductSaved": "Product ID saved",
      "admin.contributionPricing.saveProduct": "Save product ID",
      "admin.shell.backToAdmin": "Back to admin",
      "admin.shell.dashboard": "Overview",
      "admin.shell.donations": "Donations",
      "admin.shell.contributionPricing": "Contribution pricing",
      "admin.shell.certificates": "Certificates",
      "admin.shell.releases": "Releases",
      "admin.shell.notifications": "Notifications",
      "admin.shell.policies": "Policy pages",
      "admin.shell.supportFeedback": "Feedback",
      "admin.shell.supportSettings": "Support settings",
      "admin.shell.licenses": "Licenses",
      "admin.shell.users": "Users",
      "admin.shell.auditLogs": "Audit Logs",
      "admin.shell.language": "Language",
      "admin.shell.menu": "Menu",
      "admin.shell.returnToSite": "Return to site",
      "admin.shell.signOut": "Sign out",
      "admin.common.saving": "Saving...",
    };

    return messages[`admin.${key}`] ?? messages[key] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

describe("AdminContributionPricingPage", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("renders donation tier pricing without support channel settings", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "donation_tiers") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    amount: 900,
                    code: "monthly",
                    compare_at_amount: null,
                    currency: "usd",
                    description: "Monthly support",
                    id: "tier-monthly",
                    is_active: true,
                    label: "Monthly Support",
                    sort_order: 1,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "payment_product_settings") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    environment: "test",
                    is_enabled: true,
                    product_id: "pdt_test_monthly",
                    tier_code: "monthly",
                  },
                  {
                    environment: "live",
                    is_enabled: true,
                    product_id: "pdt_LiveMonthly",
                    tier_code: "monthly",
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await AdminContributionPricingPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getAllByRole("heading", { name: "Contribution pricing" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Development support tiers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Monthly Support")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0")).toBeInTheDocument();
    expect(screen.queryByText("Channel settings")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Telegram")).not.toBeInTheDocument();

    const tierForm = screen.getByDisplayValue("Monthly Support").closest("form");
    expect(tierForm).toHaveClass("sm:grid-cols-2", "xl:grid-cols-12");
    expect(tierForm?.className).not.toContain("lg:grid-cols-[minmax(0,0.8fr)");
    expect(screen.getByText("Dodo payment product IDs")).toBeInTheDocument();
    expect(screen.getByText("How checkout chooses a mode")).toBeInTheDocument();
    expect(screen.getByText("Test mode")).toBeInTheDocument();
    expect(screen.getByText("Live mode")).toBeInTheDocument();
    expect(screen.getByText("Use these IDs for local or preview testing.")).toBeInTheDocument();
    expect(screen.getByText("Use these IDs for real customer payments.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pdt_test_monthly")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pdt_LiveMonthly")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save product ID" }).length).toBeGreaterThan(0);

    const paymentSection = screen.getByText("Dodo payment product IDs").closest("section");
    expect(paymentSection).toHaveClass("overflow-hidden");
    expect(paymentSection?.querySelector(".lg\\:grid-cols-2")).toBeNull();

    const productInput = screen.getByDisplayValue("pdt_LiveMonthly");
    const productForm = productInput.closest("form");
    expect(productForm).toHaveClass("grid-cols-1", "xl:grid-cols-[minmax(8rem,0.75fr)_minmax(20rem,1.7fr)_minmax(10rem,180px)_minmax(9rem,170px)]");
    expect(productForm?.querySelector("button")?.parentElement?.parentElement).toHaveClass("xl:justify-end");
  });

  it("renders donation tiers when the original price column has not been migrated yet", async () => {
    const tierSelect = vi
      .fn()
      .mockReturnValueOnce({
        order: async () => ({
          data: null,
          error: { code: "42703", message: "column donation_tiers.compare_at_amount does not exist" },
        }),
      })
      .mockReturnValueOnce({
        order: async () => ({
          data: [
            {
              amount: 2430,
              code: "quarterly",
              currency: "usd",
              description: "Quarterly support",
              id: "tier-quarterly",
              is_active: true,
              label: "Quarterly Support",
              sort_order: 2,
            },
          ],
          error: null,
        }),
      });
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "donation_tiers") {
          return { select: tierSelect };
        }

        if (table === "payment_product_settings") {
          return {
            select: () => ({
              order: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await AdminContributionPricingPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByDisplayValue("Quarterly Support")).toBeInTheDocument();
    expect(screen.getByDisplayValue("27")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("10").some((input) => input.getAttribute("name") === "discount_percent")).toBe(true);
  });

  it("prefills payment product IDs from environment fallbacks when database rows are empty", async () => {
    process.env.DODO_PRODUCT_MONTHLY = "pdt_TestMonthly";
    process.env.DODO_LIVE_PRODUCT_MONTHLY = "pdt_LiveMonthly";
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "donation_tiers") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    amount: 900,
                    code: "monthly",
                    compare_at_amount: null,
                    currency: "usd",
                    description: "Monthly support",
                    id: "tier-monthly",
                    is_active: true,
                    label: "Monthly Support",
                    sort_order: 1,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "payment_product_settings") {
          return {
            select: () => ({
              order: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await AdminContributionPricingPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByDisplayValue("pdt_TestMonthly")).toBeInTheDocument();
    expect(screen.getByDisplayValue("pdt_LiveMonthly")).toBeInTheDocument();
  });

  it("prefills the known live Dodo product IDs when database and env rows are empty", async () => {
    delete process.env.DODO_PRODUCT_MONTHLY;
    delete process.env.DODO_LIVE_PRODUCT_MONTHLY;
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "donation_tiers") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    amount: 900,
                    code: "monthly",
                    compare_at_amount: null,
                    currency: "usd",
                    description: "Monthly support",
                    id: "tier-monthly",
                    is_active: true,
                    label: "Monthly Support",
                    sort_order: 1,
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "payment_product_settings") {
          return {
            select: () => ({
              order: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await AdminContributionPricingPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByDisplayValue("pdt_0NfSHqPkQZGNWArp4uJAF")).toBeInTheDocument();
  });
});
