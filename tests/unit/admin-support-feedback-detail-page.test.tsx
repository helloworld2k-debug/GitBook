import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminSupportFeedbackDetailPage from "@/app/[locale]/admin/support-feedback/[id]/page";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getAdminShellProps: vi.fn(),
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
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      "common.processing": "Processing...",
      "common.saving": "Saving...",
      "supportFeedback.adminMessage": "Admin",
      "supportFeedback.backToFeedback": "Back to feedback",
      "supportFeedback.conversation": "Conversation",
      "supportFeedback.description": "Review feedback",
      "supportFeedback.emptyConversation": "No replies yet.",
      "supportFeedback.eyebrow": "Admin",
      "supportFeedback.originalMessage": "Original message",
      "supportFeedback.reply": "Reply to user",
      "supportFeedback.replyPlaceholder": "Write a reply...",
      "supportFeedback.save": "Save",
      "supportFeedback.sendReply": "Send reply",
      "supportFeedback.status": "Status",
      "supportFeedback.statuses.open": "Open",
      "supportFeedback.statuses.reviewing": "Reviewing",
      "supportFeedback.statuses.closed": "Closed",
      "supportFeedback.userMessage": "User",
    };

    return messages[key] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin/shell", () => ({
  getAdminShellProps: mocks.getAdminShellProps,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("AdminSupportFeedbackDetailPage", () => {
  it("marks the thread read for the current admin when opened", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.getAdminShellProps.mockResolvedValue({
      adminLabel: "admin@example.com",
      currentPath: "/admin/support-feedback/feedback-1",
      labels: {
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
        releases: "Releases",
        returnToSite: "Return to site",
        signOut: "Sign out",
        supportFeedback: "Feedback",
        supportFeedbackUnread: (count: number) => `${count} unread feedback threads`,
        supportSettings: "Support settings",
        users: "Users",
      },
      locale: "en",
      unreadFeedbackCount: 0,
    });
    const feedbackSingle = vi.fn(async () => ({
      data: {
        id: "feedback-1",
        email: "user@example.com",
        contact: null,
        subject: "Need help",
        message: "Please help.",
        status: "open",
        created_at: "2026-05-07T10:00:00.000Z",
        updated_at: "2026-05-07T10:00:00.000Z",
        user_id: "user-1",
      },
      error: null,
    }));
    const feedbackEq = vi.fn(() => ({ single: feedbackSingle }));
    const feedbackSelect = vi.fn(() => ({ eq: feedbackEq }));
    const messagesOrder = vi.fn(async () => ({ data: [], error: null }));
    const messagesEq = vi.fn(() => ({ order: messagesOrder }));
    const messagesSelect = vi.fn(() => ({ eq: messagesEq }));
    const readUpsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "support_feedback") return { select: feedbackSelect };
      if (table === "support_feedback_messages") return { select: messagesSelect };
      if (table === "support_feedback_admin_reads") return { upsert: readUpsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    render(await AdminSupportFeedbackDetailPage({
      params: Promise.resolve({ id: "feedback-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "Need help" })).toBeInTheDocument();
    expect(readUpsert).toHaveBeenCalledWith(
      {
        admin_user_id: "admin-1",
        feedback_id: "feedback-1",
        read_at: expect.any(String),
      },
      { onConflict: "feedback_id,admin_user_id" },
    );
  });
});
