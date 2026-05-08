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
      "admin.supportSettings.publicPreviewTitle": "Public preview",
      "admin.supportSettings.publicPreviewDescription": "This is how the enabled support channels will appear to visitors on the Support page.",
      "admin.supportSettings.rowSaved": "Saved",
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
    expect(screen.queryByText("Development support tiers")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Monthly Support")).not.toBeInTheDocument();
    expect(screen.getByText("This is the public support mailbox shown on the Support page.")).toBeInTheDocument();
    expect(screen.getByText("This is how the enabled support channels will appear to visitors on the Support page.")).toBeInTheDocument();
  });

  it("opens with default settings when support settings tables are temporarily unavailable", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: () => {
        throw new TypeError("Cannot read properties of undefined (reading 'rest')");
      },
    });

    render(
      await AdminSupportSettingsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByDisplayValue("Telegram")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Email")).toBeInTheDocument();
    expect(screen.queryByText("Development support tiers")).not.toBeInTheDocument();
  });
});
