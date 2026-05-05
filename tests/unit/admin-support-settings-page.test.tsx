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
      "admin.supportSettings.enabled": "Enabled",
      "admin.supportSettings.disabled": "Disabled",
      "admin.supportSettings.save": "Save",
      "admin.supportSettings.emailHelp": "This is the public support mailbox shown on the Support page.",
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
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [
              { id: "telegram", is_enabled: true, label: "Telegram", sort_order: 10, value: "https://t.me/help" },
              { id: "email", is_enabled: true, label: "Email", sort_order: 40, value: "support@example.com" },
            ],
            error: null,
          }),
        }),
      }),
    });

    render(
      await AdminSupportSettingsPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getAllByRole("heading", { name: "Support settings" }).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("Telegram").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("support@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("This is the public support mailbox shown on the Support page.")).toBeInTheDocument();
  });
});
