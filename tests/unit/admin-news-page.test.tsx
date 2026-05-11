import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminNewsPage from "@/app/[locale]/admin/news/page";

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

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("AdminNewsPage", () => {
  it("loads editable news articles through the admin client after admin access is verified", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "support_feedback") {
          return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
        }

        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { display_name: "Admin", email: "admin@example.com" }, error: null }) }) }) };
        }

        throw new Error(`Unexpected server table: ${table}`);
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "news_articles") {
          throw new Error(`Unexpected admin table: ${table}`);
        }

        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    body: "Editable body",
                    cover_image_path: "/news/editable.webp",
                    created_at: "2026-05-01T10:00:00.000Z",
                    id: "news-1",
                    image_alt: "Editable image",
                    is_ai_generated: true,
                    published_at: null,
                    slug: "editable-ai-news",
                    summary: "Editable summary",
                    title: "Editable AI News",
                    topic: "AI",
                    updated_at: "2026-05-01T10:00:00.000Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      },
    });

    render(await AdminNewsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(mocks.createSupabaseAdminClient).toHaveBeenCalled();
    expect(screen.getByDisplayValue("editable-ai-news")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Editable body")).toBeInTheDocument();
  });

  it("publishes draft news articles with one click while keeping unpublish confirmation", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-1", email: "admin@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "support_feedback") {
          return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
        }

        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { display_name: "Admin", email: "admin@example.com" }, error: null }) }) }) };
        }

        throw new Error(`Unexpected server table: ${table}`);
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "news_articles") {
          throw new Error(`Unexpected admin table: ${table}`);
        }

        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    body: "Published body",
                    cover_image_path: "/news/published.webp",
                    created_at: "2026-05-01T10:00:00.000Z",
                    id: "news-published",
                    image_alt: "Published image",
                    is_ai_generated: true,
                    published_at: "2026-05-01T10:00:00.000Z",
                    slug: "published-news",
                    summary: "Published summary",
                    title: "Published News",
                    topic: "AI",
                    updated_at: "2026-05-01T10:00:00.000Z",
                  },
                  {
                    body: "Draft body",
                    cover_image_path: "/news/draft.webp",
                    created_at: "2026-05-01T10:00:00.000Z",
                    id: "news-draft",
                    image_alt: "Draft image",
                    is_ai_generated: true,
                    published_at: null,
                    slug: "draft-news",
                    summary: "Draft summary",
                    title: "Draft News",
                    topic: "AI",
                    updated_at: "2026-05-01T10:00:00.000Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      },
    });

    render(await AdminNewsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.queryByText("Click again to confirm this action.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(screen.getByText("Click again to confirm this action.")).toBeInTheDocument();
  });

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
    mocks.createSupabaseAdminClient.mockReturnValue({
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

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(await AdminNewsPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create article" })).toBeInTheDocument();
    expect(screen.getByText("News articles could not be loaded. You can still create a new article.")).toBeInTheDocument();
  });
});
