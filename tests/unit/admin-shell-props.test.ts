import { describe, expect, it, vi } from "vitest";
import { getAdminShellProps } from "@/lib/admin/shell";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(() => "en"),
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, number>) => {
    const messages: Record<string, string> = {
      auditLogs: "Audit Logs",
      backToAdmin: "Back to admin",
      certificates: "Certificates",
      contributionPricing: "Contribution pricing",
      dashboard: "Overview",
      donations: "Donations",
      language: "Language",
      licenses: "Licenses",
      menu: "Menu",
      notifications: "Notifications",
      policies: "Policy pages",
      releases: "Releases",
      returnToSite: "Return to site",
      signOut: "Sign out",
      supportFeedback: "Feedback",
      supportFeedbackUnread: "{count} unread feedback threads",
      supportSettings: "Support settings",
      users: "Users",
    };

    return (messages[key] ?? key).replace("{count}", String(values?.count ?? ""));
  }),
}));

function createQuery(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data, error: null })),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({ data, error: null })),
  };

  return query;
}

describe("getAdminShellProps", () => {
  it("counts unread feedback threads from user messages rather than open status", async () => {
    const feedbackQuery = createQuery([
      {
        id: "feedback-unread",
        created_at: "2026-05-07T10:00:00.000Z",
        support_feedback_admin_reads: [],
        support_feedback_messages: [{ author_role: "user", created_at: "2026-05-07T10:05:00.000Z" }],
      },
      {
        id: "feedback-read",
        created_at: "2026-05-07T09:00:00.000Z",
        support_feedback_admin_reads: [{ admin_user_id: "admin-1", read_at: "2026-05-07T09:10:00.000Z" }],
        support_feedback_messages: [{ author_role: "user", created_at: "2026-05-07T09:05:00.000Z" }],
      },
    ]);
    const profileQuery = createQuery({ display_name: "Admin User", email: "admin@example.com" });
    const from = vi.fn((table: string) => {
      if (table === "support_feedback") return feedbackQuery;
      if (table === "profiles") return profileQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } })),
      },
      from,
    });

    const props = await getAdminShellProps("en", "/admin");

    expect(feedbackQuery.select).toHaveBeenCalledWith("id,created_at,support_feedback_admin_reads(admin_user_id,read_at),support_feedback_messages(author_role,created_at)");
    expect(props.unreadFeedbackCount).toBe(1);
    expect(props.labels.supportFeedbackUnread(1)).toBe("1 unread feedback threads");
  });
});
