import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPoliciesPage from "@/app/[locale]/admin/policies/page";

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
      "admin.common.saving": "Saving...",
      "admin.policies.body": "Body",
      "admin.policies.description": "Edit the English policy pages linked from the public footer.",
      "admin.policies.eyebrow": "Admin",
      "admin.policies.save": "Save policy",
      "admin.policies.summary": "Summary",
      "admin.policies.title": "Policy pages",
      "admin.policies.titleLabel": "Title",
      "admin.shell.auditLogs": "Audit Logs",
      "admin.shell.backToAdmin": "Back to admin",
      "admin.shell.certificates": "Certificates",
      "admin.shell.contributionPricing": "Contribution pricing",
      "admin.shell.dashboard": "Overview",
      "admin.shell.donations": "Donations",
      "admin.shell.language": "Language",
      "admin.shell.licenses": "Licenses",
      "admin.shell.menu": "Menu",
      "admin.shell.notifications": "Notifications",
      "admin.shell.policies": "Policy pages",
      "admin.shell.releases": "Releases",
      "admin.shell.returnToSite": "Return to site",
      "admin.shell.signOut": "Sign out",
      "admin.shell.supportFeedback": "Feedback",
      "admin.shell.supportFeedbackUnread": "{count} unread feedback threads",
      "admin.shell.supportSettings": "Support settings",
      "admin.shell.users": "Users",
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

describe("AdminPoliciesPage", () => {
  it("renders editable policy page forms for admins", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "policy_pages") {
          return {
            select: () => ({
              order: async () => ({
                data: [
                  {
                    body: "Terms body",
                    slug: "terms",
                    summary: "Terms summary",
                    title: "Terms of Service",
                    updated_at: "2026-05-08T00:00:00.000Z",
                  },
                  {
                    body: "Privacy body",
                    slug: "privacy",
                    summary: "Privacy summary",
                    title: "Privacy Policy",
                    updated_at: "2026-05-08T00:00:00.000Z",
                  },
                ],
                error: null,
              }),
            }),
          };
        }

        if (table === "support_feedback") {
          return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
        }

        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { display_name: "Admin", email: "admin@example.com" }, error: null }) }) }) };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(await AdminPoliciesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Policy pages" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Terms of Service")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Terms body")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save policy" }).length).toBeGreaterThan(0);
  });
});
