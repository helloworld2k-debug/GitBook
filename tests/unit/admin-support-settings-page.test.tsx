import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSupportSettingsPage from "@/app/[locale]/admin/support-settings/page";

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
      "admin.supportSettings.eyebrow": "Admin",
      "admin.supportSettings.title": "Support settings",
      "admin.supportSettings.description": "Manage public support contact channels.",
      "admin.supportSettings.channel": "Channel",
      "admin.supportSettings.value": "Value",
      "admin.supportSettings.status": "Status",
      "admin.supportSettings.sortOrder": "Sort order",
      "admin.supportSettings.sortOrderHelp": "Smaller numbers appear first in the public channel list.",
      "admin.supportSettings.enabled": "Enabled",
      "admin.supportSettings.disabled": "Disabled",
      "admin.supportSettings.statusHelp": "Switch this channel on only when the value is ready for public display.",
      "admin.supportSettings.save": "Save",
      "admin.supportSettings.guidanceTitle": "How these settings work",
      "admin.supportSettings.guidanceBody": "Enabled channels are shown publicly on the Support page.",
      "admin.supportSettings.emailHelp": "This is the public support mailbox shown on the Support page.",
      "admin.supportSettings.valueHintTelegram": "Use a full Telegram URL such as https://t.me/your_channel",
      "admin.supportSettings.valueHintEmail": "Use the public mailbox users should email for support",
      "admin.supportSettings.previewTitle": "Channel settings",
      "admin.supportSettings.previewDescription": "Edit each support channel below.",
      "admin.supportSettings.tiersTitle": "Development support tiers",
      "admin.supportSettings.tiersDescription": "Update the prices and copy shown on the Contributions page.",
      "admin.supportSettings.tierLabel": "Tier label",
      "admin.supportSettings.tierDescription": "Description",
      "admin.supportSettings.tierAmount": "Price in cents",
      "admin.supportSettings.tierCompareAtAmount": "Original price in cents",
      "admin.supportSettings.tierActive": "Active",
      "admin.supportSettings.tierInactive": "Inactive",
      "admin.supportSettings.tierStatusHelp": "Inactive tiers are hidden from the Contributions page.",
      "admin.supportSettings.tierSaved": "Tier saved",
      "admin.supportSettings.publicPreviewTitle": "Public preview",
      "admin.supportSettings.publicPreviewDescription": "This is how the enabled support channels will appear to visitors on the Support page.",
      "admin.supportSettings.rowSaved": "Saved",
      "admin.shell.backToAdmin": "Back to admin",
      "admin.shell.dashboard": "Overview",
      "admin.shell.donations": "Donations",
      "admin.shell.certificates": "Certificates",
      "admin.shell.releases": "Releases",
      "admin.shell.notifications": "Notifications",
      "admin.shell.supportFeedback": "Feedback",
      "admin.shell.supportSettings": "Support settings",
      "admin.shell.licenses": "Licenses",
      "admin.shell.users": "Users",
      "admin.shell.auditLogs": "Audit Logs",
      "admin.shell.language": "Language",
      "admin.shell.menu": "Menu",
      "admin.shell.returnToSite": "Return to site",
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

describe("AdminSupportSettingsPage", () => {
  it("renders support channel settings rows for admins", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "support_contact_channels") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  { id: "telegram", is_enabled: true, label: "Telegram", sort_order: 10, value: "https://t.me/help" },
                  { id: "email", is_enabled: true, label: "Email", sort_order: 40, value: "support@example.com" },
                ],
                error: null,
              }),
            }),
          };
        }

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

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await AdminSupportSettingsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getAllByRole("heading", { name: "Support settings" }).length).toBeGreaterThan(0);
    expect(screen.getByText("How these settings work")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Telegram").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("support@example.com").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("https://t.me/your_channel")).toBeInTheDocument();
    expect(screen.getByText("Use a full Telegram URL such as https://t.me/your_channel")).toBeInTheDocument();
    expect(screen.getByText("Development support tiers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Monthly Support")).toBeInTheDocument();
    expect(screen.getByDisplayValue("900")).toBeInTheDocument();
    expect(screen.getByText("This is the public support mailbox shown on the Support page.")).toBeInTheDocument();
    expect(screen.getByText("This is how the enabled support channels will appear to visitors on the Support page.")).toBeInTheDocument();
  });
});
