import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewsPage from "@/app/[locale]/news/page";
import NewsArticlePage from "@/app/[locale]/news/[slug]/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/i18n/page-locale", () => ({
  resolvePageLocale: (locale: string) => locale,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function createNewsListClient() {
  return {
    from: (table: string) => {
      if (table !== "news_articles") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: () => ({
          not: () => ({
            lte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: "article-1",
                      slug: "vision-foundation-models-enter-the-field",
                      title: "Vision Foundation Models Enter the Field",
                      summary: "AI-generated visual systems are moving from labs into field workflows.",
                      cover_image_path: "/news/vision-foundation-models-enter-the-field.webp",
                      image_alt: "AI generated abstract vision model illustration",
                      topic: "vision foundation models",
                      is_ai_generated: true,
                      published_at: "2026-05-01T10:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

describe("News pages", () => {
  it("lists published AI-created news articles with image, topic, date, and summary", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(createNewsListClient());

    render(await NewsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vision Foundation Models Enter the Field/ })).toHaveAttribute(
      "href",
      "/news/vision-foundation-models-enter-the-field",
    );
    expect(screen.getByText("AI-created")).toBeInTheDocument();
    expect(screen.getByText("vision foundation models")).toBeInTheDocument();
    expect(screen.getByText("AI-generated visual systems are moving from labs into field workflows.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AI generated abstract vision model illustration" })).toHaveAttribute(
      "src",
      expect.stringContaining("%2Fnews%2Fvision-foundation-models-enter-the-field.webp"),
    );
  });

  it("renders a published news article as plain text paragraphs", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: (table: string) => {
        if (table !== "news_articles") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                lte: () => ({
                  single: async () => ({
                    data: {
                      slug: "vision-foundation-models-enter-the-field",
                      title: "Vision Foundation Models Enter the Field",
                      summary: "AI-generated visual systems are moving from labs into field workflows.",
                      body: "First paragraph about AI vision.\\n\\nSecond paragraph about scientific recognition.",
                      cover_image_path: "/news/vision-foundation-models-enter-the-field.webp",
                      image_alt: "AI generated abstract vision model illustration",
                      topic: "vision foundation models",
                      is_ai_generated: true,
                      published_at: "2026-05-01T10:00:00.000Z",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      },
    });

    render(await NewsArticlePage({
      params: Promise.resolve({ locale: "en", slug: "vision-foundation-models-enter-the-field" }),
    }));

    expect(screen.getByRole("heading", { name: "Vision Foundation Models Enter the Field" })).toBeInTheDocument();
    expect(screen.getByText("First paragraph about AI vision.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph about scientific recognition.")).toBeInTheDocument();
    expect(screen.getByText("AI-created")).toBeInTheDocument();
  });

  it("returns not found for unpublished or missing news articles", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            not: () => ({
              lte: () => ({
                single: async () => ({ data: null, error: new Error("not found") }),
              }),
            }),
          }),
        }),
      }),
    });

    await expect(NewsArticlePage({
      params: Promise.resolve({ locale: "en", slug: "draft-story" }),
    })).rejects.toThrow("notFound");
  });
});
