import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getDefaultPolicyPage, isPolicyPageSlug, type PolicyPageContent } from "@/lib/policies/defaults";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PolicyPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

async function getPolicyPage(slug: PolicyPageContent["slug"]) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("policy_pages")
      .select("slug,title,summary,body,updated_at")
      .eq("slug", slug)
      .single();

    return (data as PolicyPageContent | null) ?? getDefaultPolicyPage(slug);
  } catch {
    return getDefaultPolicyPage(slug);
  }
}

function splitPolicyBody(body: string) {
  return body.replaceAll("\\n", "\n").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (!isPolicyPageSlug(slug)) {
    notFound();
  }

  const page = await getPolicyPage(slug);

  return (
    <main className="bg-white">
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="text-sm font-semibold uppercase tracking-normal text-cyan-700">Policy</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{page.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{page.summary}</p>
        {page.updated_at ? (
          <p className="mt-3 text-sm text-slate-500">
            Last updated {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(page.updated_at))}
          </p>
        ) : null}
        <div className="mt-10 space-y-6 text-base leading-8 text-slate-700">
          {splitPolicyBody(page.body).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
