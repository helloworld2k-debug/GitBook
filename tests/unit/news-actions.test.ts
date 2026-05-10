import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createNewsArticle,
  publishNewsArticle,
  unpublishNewsArticle,
  updateNewsArticle,
} from "@/app/[locale]/admin/actions/news";

const mocks = vi.hoisted(() => ({
  insertAdminAuditLog: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mocks.supabase,
}));

vi.mock("@/app/[locale]/admin/actions/audit", () => ({
  insertAdminAuditLog: mocks.insertAdminAuditLog,
}));

function baseFormData() {
  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("return_to", "/admin/news");
  formData.set("slug", "vision-foundation-models-enter-the-field");
  formData.set("title", "Vision Foundation Models Enter the Field");
  formData.set("summary", "AI-generated visual systems are moving from labs into field workflows.");
  formData.set("body", "First paragraph.\\n\\nSecond paragraph.");
  formData.set("cover_image_path", "/news/vision-foundation-models-enter-the-field.webp");
  formData.set("image_alt", "AI generated abstract vision model illustration");
  formData.set("topic", "vision foundation models");

  return formData;
}

describe("news admin actions", () => {
  beforeEach(() => {
    mocks.insertAdminAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.redirect.mockClear();
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.revalidatePath.mockClear();
    mocks.supabase.from.mockReset();
  });

  it("creates a draft news article, audits it, and revalidates news paths", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "news_articles") return { insert };
      if (table === "admin_audit_logs") return { insert: vi.fn(async () => ({ error: null })) };
      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = baseFormData();

    await expect(createNewsArticle(formData)).rejects.toThrow("redirect:/en/admin/news?notice=news-created");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      body: "First paragraph.\\n\\nSecond paragraph.",
      cover_image_path: "/news/vision-foundation-models-enter-the-field.webp",
      created_by: "admin-1",
      image_alt: "AI generated abstract vision model illustration",
      is_ai_generated: true,
      published_at: null,
      slug: "vision-foundation-models-enter-the-field",
      summary: "AI-generated visual systems are moving from labs into field workflows.",
      title: "Vision Foundation Models Enter the Field",
      topic: "vision foundation models",
      updated_by: "admin-1",
    }));
    expect(mocks.insertAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "create_news_article",
      adminUserId: "admin-1",
      targetType: "news_article",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/news");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/news");
  });

  it("updates a news article and preserves published state separately from edits", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const single = vi.fn(async () => ({
      data: { id: "news-1", slug: "old-slug", title: "Old title", published_at: "2026-05-01T10:00:00.000Z" },
      error: null,
    }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "news_articles") {
        return {
          select: () => ({ eq: () => ({ single }) }),
          update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = baseFormData();
    formData.set("article_id", "news-1");

    await expect(updateNewsArticle(formData)).rejects.toThrow("redirect:/en/admin/news?notice=news-updated");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      slug: "vision-foundation-models-enter-the-field",
      title: "Vision Foundation Models Enter the Field",
      updated_by: "admin-1",
    }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ published_at: expect.anything() }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/news/old-slug");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/news/vision-foundation-models-enter-the-field");
  });

  it("publishes and unpublishes news articles through explicit actions", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const single = vi.fn(async () => ({
      data: { slug: "vision-foundation-models-enter-the-field" },
      error: null,
    }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "news_articles") {
        return {
          select: () => ({ eq: () => ({ single }) }),
          update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("return_to", "/admin/news");
    formData.set("article_id", "news-1");

    await expect(publishNewsArticle(formData)).rejects.toThrow("redirect:/en/admin/news?notice=news-published");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ published_at: expect.any(String) }));

    await expect(unpublishNewsArticle(formData)).rejects.toThrow("redirect:/en/admin/news?notice=news-unpublished");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ published_at: null }));
  });
});
