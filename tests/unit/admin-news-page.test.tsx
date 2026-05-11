import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminNewsPage from "@/app/[locale]/admin/news/page";

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
      "admin.common.processing": "Processing...",
      "admin.common.saving": "Saving...",
      "admin.news.aiGenerated": "AI-created",
      "admin.news.body": "Body",
      "admin.news.coverImagePath": "Cover image path",
      "admin.news.create": "Create article",
      "admin.news.createTitle": "Create article",
      "admin.news.description": "Manage AI-created news articles shown on the public News page.",
      "admin.news.draft": "Draft",
      "admin.news.empty": "No news articles yet.",
      "admin.news.eyebrow": "Admin",
      "admin.news.imageAlt": "Image alt",
      "admin.news.loadFailed": "News articles could not be loaded. You can still create a new article.",
      "admin.news.publish": "Publish",
      "admin.news.published": "Published",
      "admin.news.publishedAt": "Published at",
      "admin.news.publishNow": "Publish now",
      "admin.news.save": "Save",
      "admin.news.slug": "Slug",
      "admin.news.summary": "Summary",
      "admin.news.title": "News",
      "admin.news.titleLabel": "Title",
      "admin.news.topic": "Topic",
      "admin.news.unpublish": "Unpublish",
      "admin.news.updatedAt": "Updated at",
      "admin.news.viewPublic": "View public",
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
      "admin.shell.releases": "Releases",
      "admin.shell.returnToSite": "Return to site",
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

describe("AdminNewsPage", () => {
  it("opens the news admin page even when news articles cannot be loaded", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "news_articles") {
          return {
            select: () => ({
              order: () => ({
                limit: async () => ({ data: null, error: new Error("relation news_articles does not exist") }),
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

    render(await AdminNewsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create article" })).toBeInTheDocument();
    expect(screen.getByText("News articles could not be loaded. You can still create a new article.")).toBeInTheDocument();
  });
});
