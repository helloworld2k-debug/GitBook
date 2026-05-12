import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminRegistrationSecurityPage from "@/app/[locale]/admin/registration-security/page";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
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
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      "admin.common.processing": "Processing...",
      "admin.registrationSecurity.activeBlocks": "Active blocks",
      "admin.registrationSecurity.block": "Block",
      "admin.registrationSecurity.blockedUntil": "Blocked until",
      "admin.registrationSecurity.createBlock": "Create block",
      "admin.registrationSecurity.description": "Review signup abuse patterns and block risky sources.",
      "admin.registrationSecurity.domain": "Domain",
      "admin.registrationSecurity.domainSummary": "Domain summary",
      "admin.registrationSecurity.email": "Email",
      "admin.registrationSecurity.emptyBlocks": "No active blocks.",
      "admin.registrationSecurity.emptyAttempts": "No registration attempts yet.",
      "admin.registrationSecurity.ip": "IP",
      "admin.registrationSecurity.ipSummary": "IP summary",
      "admin.registrationSecurity.lastSeen": "Last seen",
      "admin.registrationSecurity.recentAttempts": "Recent attempts",
      "admin.registrationSecurity.reason": "Reason",
      "admin.registrationSecurity.revoke": "Revoke",
      "admin.registrationSecurity.scope": "Scope",
      "admin.registrationSecurity.scopeValue": "Value",
      "admin.registrationSecurity.title": "Registration security",
      "admin.registrationSecurity.totalAttempts": "Attempts",
      "admin.registrationSecurity.uniqueEmails": "Unique emails",
      "admin.registrationSecurity.userAgent": "User agent",
      "admin.shell.auditLogs": "Audit Logs",
      "admin.shell.backToAdmin": "Back to admin",
      "admin.shell.certificates": "Certificates",
      "admin.shell.contributionPricing": "Contribution pricing",
      "admin.shell.dashboard": "Overview",
      "admin.shell.donations": "Donations",
      "admin.shell.language": "Language",
      "admin.shell.licenses": "Licenses",
      "admin.shell.menu": "Menu",
      "admin.shell.news": "News",
      "admin.shell.notifications": "Notifications",
      "admin.shell.policies": "Policy pages",
      "admin.shell.registrationSecurity": "Registration security",
      "admin.shell.releases": "Releases",
      "admin.shell.returnToSite": "Return to site",
      "admin.shell.signOut": "Sign out",
      "admin.shell.supportFeedback": "Feedback",
      "admin.shell.supportFeedbackUnread": "{count} unread feedback threads",
      "admin.shell.supportSettings": "Support settings",
      "admin.shell.users": "Users",
    };

    return (messages[`admin.${key}`] ?? messages[key] ?? key).replace("{count}", String(values?.count ?? ""));
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("AdminRegistrationSecurityPage", () => {
  it("renders registration attempts, aggregated signals, and active block controls", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "registration_attempts") {
          return {
            select: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      created_at: "2026-05-12T08:00:00.000Z",
                      email_domain: "example.com",
                      email_normalized: "a@example.com",
                      id: "attempt-1",
                      ip_address: "203.0.113.10",
                      user_agent: "Browser A",
                    },
                    {
                      created_at: "2026-05-12T08:05:00.000Z",
                      email_domain: "example.com",
                      email_normalized: "b@example.com",
                      id: "attempt-2",
                      ip_address: "203.0.113.10",
                      user_agent: "Browser B",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "registration_blocks") {
          return {
            select: () => ({
              is: () => ({
                gt: () => ({
                  order: async () => ({
                    data: [
                      {
                        blocked_until: "2026-05-13T08:00:00.000Z",
                        created_at: "2026-05-12T08:10:00.000Z",
                        id: "block-1",
                        reason: "Abuse",
                        scope: "ip",
                        scope_value: "203.0.113.10",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(await AdminRegistrationSecurityPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Registration security" })).toBeInTheDocument();
    expect(screen.getAllByText("203.0.113.10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("example.com").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("203.0.113.10")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create block" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Block" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });
});
