import Image from "next/image";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { formatNewsDate, splitNewsBody } from "@/lib/news/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NewsArticlePageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

type NewsArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_image_path: string;
  image_alt: string;
  topic: string;
  is_ai_generated: boolean;
  published_at: string;
};

async function getPublishedNewsArticle(slug: string) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("news_articles")
    .select("slug,title,summary,body,cover_image_path,image_alt,topic,is_ai_generated,published_at")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .lte("published_at", now)
    .single();

  if (error || !data) {
    return null;
  }

  return data as NewsArticle;
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = resolvePageLocale(localeParam);
  const article = await getPublishedNewsArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="tech-shell flex-1">
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <Link className="text-sm font-semibold text-cyan-100 hover:text-cyan-50" href="/news">
          Back to News
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-normal">
          {article.is_ai_generated ? (
            <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100">AI-created</span>
          ) : null}
          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-slate-300">{article.topic}</span>
          <span className="text-slate-500">{formatNewsDate(article.published_at, locale)}</span>
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-normal text-white sm:text-5xl">{article.title}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">{article.summary}</p>
        <Image
          alt={article.image_alt}
          className="mt-8 aspect-[16/9] w-full rounded-lg border border-cyan-300/10 object-cover shadow-[0_24px_80px_rgba(15,23,42,0.45)]"
          height={675}
          src={article.cover_image_path}
          width={1200}
        />
        <div className="mt-10 space-y-6 text-base leading-8 text-slate-200">
          {splitNewsBody(article.body).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
