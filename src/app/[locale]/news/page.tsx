import Image from "next/image";
import { Link } from "@/i18n/routing";
import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { formatNewsDate } from "@/lib/news/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NewsPageProps = {
  params: Promise<{ locale: string }>;
};

type NewsArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cover_image_path: string;
  image_alt: string;
  topic: string;
  is_ai_generated: boolean;
  published_at: string;
};

async function getPublishedNewsArticles() {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("news_articles")
    .select("id,slug,title,summary,cover_image_path,image_alt,topic,is_ai_generated,published_at")
    .not("published_at", "is", null)
    .lte("published_at", now)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []) as NewsArticleListItem[];
}

export default async function NewsPage({ params }: NewsPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);
  const articles = await getPublishedNewsArticles();

  return (
    <main className="tech-shell flex-1">
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
          AI-created research frontiers
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">News</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
          Original AI-generated articles on artificial intelligence, visual recognition, and scientific imaging trends.
        </p>

        {articles.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <Link
                className="glass-panel group overflow-hidden rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                href={`/news/${article.slug}`}
                key={article.id}
              >
                <Image
                  alt={article.image_alt}
                  className="aspect-[16/9] w-full object-cover"
                  height={675}
                  loading="lazy"
                  src={article.cover_image_path}
                  width={1200}
                />
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-normal">
                    {article.is_ai_generated ? (
                      <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100">AI-created</span>
                    ) : null}
                    <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-slate-300">{article.topic}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-white group-hover:text-cyan-100">{article.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{article.summary}</p>
                  <p className="mt-4 text-xs text-slate-500">{formatNewsDate(article.published_at, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="glass-panel mt-8 rounded-lg px-5 py-6 text-sm text-slate-300">No news articles are published yet.</p>
        )}
      </section>
    </main>
  );
}
