"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import {
  getBoundedString,
  getNewsSlug,
  getPublicImagePath,
  getRequiredString,
  getSafeLocale,
  MAX_NEWS_BODY_LENGTH,
  MAX_NEWS_IMAGE_ALT_LENGTH,
  MAX_NEWS_SUMMARY_LENGTH,
  MAX_NEWS_TITLE_LENGTH,
  MAX_NEWS_TOPIC_LENGTH,
} from "./validation";

function getNewsArticleInput(formData: FormData) {
  return {
    body: getBoundedString(formData, "body", "Article body is required", MAX_NEWS_BODY_LENGTH),
    cover_image_path: getPublicImagePath(formData, "cover_image_path"),
    image_alt: getBoundedString(formData, "image_alt", "Image alt text is required", MAX_NEWS_IMAGE_ALT_LENGTH),
    slug: getNewsSlug(formData),
    summary: getBoundedString(formData, "summary", "Article summary is required", MAX_NEWS_SUMMARY_LENGTH),
    title: getBoundedString(formData, "title", "Article title is required", MAX_NEWS_TITLE_LENGTH),
    topic: getBoundedString(formData, "topic", "Article topic is required", MAX_NEWS_TOPIC_LENGTH),
  };
}

function revalidateNewsPaths(locale: string, slug?: string | null, previousSlug?: string | null) {
  revalidatePath(`/${locale}/admin/news`);
  revalidatePath(`/${locale}/news`);
  if (slug) {
    revalidatePath(`/${locale}/news/${slug}`);
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/${locale}/news/${previousSlug}`);
  }
}

async function getArticleSlug(articleId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("news_articles")
    .select("slug")
    .eq("id", articleId)
    .single();

  return data?.slug ?? null;
}

export async function createNewsArticle(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const input = getNewsArticleInput(formData);
  const shouldPublish = formData.get("publish_now") === "on";
  const now = new Date().toISOString();
  const { error } = await createSupabaseAdminClient().from("news_articles").insert({
    ...input,
    created_by: admin.id,
    is_ai_generated: true,
    published_at: shouldPublish ? now : null,
    updated_by: admin.id,
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/news",
      formData,
      key: "news-create-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "create_news_article",
    adminUserId: admin.id,
    after: { ...input, published_at: shouldPublish ? now : null },
    reason: `Created news article ${input.slug}`,
    targetId: input.slug,
    targetType: "news_article",
  });

  revalidateNewsPaths(locale, input.slug);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/news",
    formData,
    key: "news-created",
    locale,
    tone: "notice",
  });
}

export async function updateNewsArticle(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const articleId = getRequiredString(formData, "article_id", "Article is required");
  const input = getNewsArticleInput(formData);
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("news_articles")
    .select("id,slug,title,summary,body,cover_image_path,image_alt,topic,published_at")
    .eq("id", articleId)
    .single();

  const { error } = await supabase
    .from("news_articles")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", articleId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/news",
      formData,
      key: "news-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_news_article",
    adminUserId: admin.id,
    after: input,
    before: before ?? null,
    reason: `Updated news article ${input.slug}`,
    targetId: articleId,
    targetType: "news_article",
  });

  revalidateNewsPaths(locale, input.slug, before?.slug);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/news",
    formData,
    key: "news-updated",
    locale,
    tone: "notice",
  });
}

export async function publishNewsArticle(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const articleId = getRequiredString(formData, "article_id", "Article is required");
  const slug = await getArticleSlug(articleId);
  const { error } = await createSupabaseAdminClient()
    .from("news_articles")
    .update({ published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", articleId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/news",
      formData,
      key: "news-publish-failed",
      locale,
      tone: "error",
    });
  }

  revalidateNewsPaths(locale, slug);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/news",
    formData,
    key: "news-published",
    locale,
    tone: "notice",
  });
}

export async function unpublishNewsArticle(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const articleId = getRequiredString(formData, "article_id", "Article is required");
  const slug = await getArticleSlug(articleId);
  const { error } = await createSupabaseAdminClient()
    .from("news_articles")
    .update({ published_at: null, updated_at: new Date().toISOString() })
    .eq("id", articleId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/news",
      formData,
      key: "news-unpublish-failed",
      locale,
      tone: "error",
    });
  }

  revalidateNewsPaths(locale, slug);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/news",
    formData,
    key: "news-unpublished",
    locale,
    tone: "notice",
  });
}
