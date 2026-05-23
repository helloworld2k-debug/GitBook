import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSupportSettingsPage, { SupportChannelSettingsForm } from "@/app/[locale]/admin/support-settings/page";

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
      "admin.supportSettings.paymentMaintenanceTitle": "Payment maintenance",
      "admin.supportSettings.paymentMaintenanceDescription": "Pause new checkout sessions without changing live or test payment credentials.",
      "admin.supportSettings.paymentMaintenanceStatus": "Checkout status",
      "admin.supportSettings.paymentMaintenanceAvailable": "Accepting payments",
      "admin.supportSettings.paymentMaintenancePaused": "Paused",
      "admin.supportSettings.paymentMaintenanceMessage": "Maintenance message",
      "admin.supportSettings.paymentMaintenanceMessageHelp": "Shown to visitors while checkout is paused.",
      "admin.supportSettings.paymentMaintenanceSave": "Save payment status",
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

        if (table === "operational_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    value: {
                      is_paused: true,
                      message: "Checkout is paused while we investigate a payment issue.",
                    },
                  },
                  error: null,
                }),
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
    expect(screen.getByText("Payment maintenance")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Checkout is paused while we investigate a payment issue.")).toBeInTheDocument();
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

describe("SupportChannelSettingsForm", () => {
  const translate = (key: string) => {
    const messages: Record<string, string> = {
      "supportSettings.channel": "Channel",
      "supportSettings.emailHelp": "This is the public support mailbox shown on the Support page.",
      "supportSettings.enabled": "Enabled",
      "supportSettings.save": "Save",
      "supportSettings.sortOrder": "Sort order",
      "supportSettings.sortOrderHelp": "Smaller numbers appear first in the public channel list.",
      "supportSettings.status": "Status",
      "supportSettings.statusHelp": "Switch this channel on only when the value is ready for public display.",
      "supportSettings.value": "Value",
      "supportSettings.valueHintEmail": "Use the public mailbox users should email for support",
    };

    return messages[key] ?? key;
  };

  it("uses a responsive form grid that stacks controls before the content gets cramped", () => {
    render(
      <SupportChannelSettingsForm
        channel={{
          id: "email",
          is_enabled: true,
          label: "Email",
          sort_order: 40,
          value: "support@example.com",
        }}
        channelHintKey={{ email: "supportSettings.valueHintEmail" }}
        channelPlaceholders={{ email: "support@example.com" }}
        locale="en"
        t={translate}
      />,
    );

    const form = screen.getByRole("form", { name: "Email" });
    expect(form).toHaveClass("grid-cols-1", "xl:grid-cols-[minmax(8rem,0.85fr)_minmax(14rem,1.55fr)_minmax(12rem,240px)_minmax(8rem,120px)_minmax(9rem,160px)]");
    expect(form).not.toHaveClass("lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)_240px_120px_160px]");
    expect(screen.getByRole("button", { name: "Save" }).parentElement?.parentElement).toHaveClass("md:col-span-2", "xl:col-span-1");
  });
});
