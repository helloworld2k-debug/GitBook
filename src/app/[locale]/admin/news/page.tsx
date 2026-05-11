import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Link } from "@/i18n/routing";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNewsArticle, publishNewsArticle, unpublishNewsArticle, updateNewsArticle } from "../actions";

type AdminNewsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

type AdminNewsArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_image_path: string;
  image_alt: string;
  topic: string;
  is_ai_generated: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

async function getAdminNewsArticles() {
  try {
    const { data: articles, error } = await createSupabaseAdminClient()
      .from("news_articles")
      .select("id,slug,title,summary,body,cover_image_path,image_alt,topic,is_ai_generated,published_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      return { articles: [] as AdminNewsArticle[], loadError: true };
    }

    return { articles: (articles ?? []) as AdminNewsArticle[], loadError: false };
  } catch {
    return { articles: [] as AdminNewsArticle[], loadError: true };
  }
}

function TextInput({
  label,
  maxLength,
  name,
  required = true,
  type = "text",
  value,
}: {
  label: string;
  maxLength?: number;
  name: string;
  required?: boolean;
  type?: string;
  value?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-950"
        defaultValue={value}
        maxLength={maxLength}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  maxLength,
  minHeight = "min-h-32",
  name,
  value,
}: {
  label: string;
  maxLength?: number;
  minHeight?: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <textarea
        className={`${minHeight} rounded-md border border-slate-300 px-3 py-2 text-slate-950`}
        defaultValue={value}
        maxLength={maxLength}
        name={name}
        required
      />
    </label>
  );
}

export default async function AdminNewsPage({ params, searchParams }: AdminNewsPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;

  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/news`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/news");
  const { articles: newsArticles, loadError } = await getAdminNewsArticles();

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("news.description")}
          eyebrow={t("news.eyebrow")}
          title={t("news.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />
        {loadError ? (
          <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("news.loadFailed")}
          </div>
        ) : null}

        <AdminCard className="p-5">
          <h2 className="text-base font-semibold text-slate-950">{t("news.createTitle")}</h2>
          <form action={createNewsArticle} className="mt-4 grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <input name="return_to" type="hidden" value="/admin/news" />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label={t("news.slug")} maxLength={120} name="slug" />
              <TextInput label={t("news.titleLabel")} maxLength={180} name="title" />
            </div>
            <TextArea label={t("news.summary")} maxLength={360} minHeight="min-h-24" name="summary" />
            <TextArea label={t("news.body")} maxLength={7000} minHeight="min-h-48" name="body" />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label={t("news.topic")} maxLength={120} name="topic" />
              <TextInput label={t("news.coverImagePath")} maxLength={240} name="cover_image_path" value="/news/" />
              <TextInput label={t("news.imageAlt")} maxLength={220} name="image_alt" />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
              <input className="size-4" name="publish_now" type="checkbox" />
              {t("news.publishNow")}
            </label>
            <AdminSubmitButton className="min-h-11 w-fit rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.processing")}>
              {t("news.create")}
            </AdminSubmitButton>
          </form>
        </AdminCard>

        <div className="mt-6 grid gap-4">
          {newsArticles.length > 0 ? (
            newsArticles.map((article) => (
              <AdminCard className="p-5" key={article.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{article.title}</h2>
                      <AdminStatusBadge tone={article.published_at ? "success" : "neutral"}>
                        {article.published_at ? t("news.published") : t("news.draft")}
                      </AdminStatusBadge>
                      {article.is_ai_generated ? (
                        <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{t("news.aiGenerated")}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {t("news.updatedAt")}: {formatDateTimeWithSeconds(article.updated_at, locale)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t("news.publishedAt")}: {article.published_at ? formatDateTimeWithSeconds(article.published_at, locale) : "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.published_at ? (
                      <Link
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
                        href={`/news/${article.slug}`}
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {t("news.viewPublic")}
                      </Link>
                    ) : null}
                    <form action={article.published_at ? unpublishNewsArticle : publishNewsArticle}>
                      <input name="locale" type="hidden" value={locale} />
                      <input name="return_to" type="hidden" value="/admin/news" />
                      <input name="article_id" type="hidden" value={article.id} />
                      <ConfirmActionButton
                        className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700"
                        confirmLabel={article.published_at ? t("news.unpublish") : t("news.publish")}
                        pendingLabel={t("common.processing")}
                      >
                        {article.published_at ? t("news.unpublish") : t("news.publish")}
                      </ConfirmActionButton>
                    </form>
                  </div>
                </div>

                <form action={updateNewsArticle} className="mt-5 grid gap-4 border-t border-slate-200 pt-5">
                  <input name="locale" type="hidden" value={locale} />
                  <input name="return_to" type="hidden" value="/admin/news" />
                  <input name="article_id" type="hidden" value={article.id} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput label={t("news.slug")} maxLength={120} name="slug" value={article.slug} />
                    <TextInput label={t("news.titleLabel")} maxLength={180} name="title" value={article.title} />
                  </div>
                  <TextArea label={t("news.summary")} maxLength={360} minHeight="min-h-24" name="summary" value={article.summary} />
                  <TextArea label={t("news.body")} maxLength={7000} minHeight="min-h-48" name="body" value={article.body} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <TextInput label={t("news.topic")} maxLength={120} name="topic" value={article.topic} />
                    <TextInput label={t("news.coverImagePath")} maxLength={240} name="cover_image_path" value={article.cover_image_path} />
                    <TextInput label={t("news.imageAlt")} maxLength={220} name="image_alt" value={article.image_alt} />
                  </div>
                  <AdminSubmitButton className="min-h-11 w-fit rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
                    {t("news.save")}
                  </AdminSubmitButton>
                </form>
              </AdminCard>
            ))
          ) : (
            <AdminCard className="px-5 py-6">
              <p className="text-sm text-slate-600">{t("news.empty")}</p>
            </AdminCard>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
