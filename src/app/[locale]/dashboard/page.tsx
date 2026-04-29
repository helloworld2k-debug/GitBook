import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const t = await getTranslations("dashboard");
  const supabase = await createSupabaseServerClient();

  const [{ count: donationCount, error: donationError }, { count: certificateCount, error: certificateError }] =
    await Promise.all([
      supabase.from("donations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

  if (donationError) {
    throw donationError;
  }

  if (certificateError) {
    throw certificateError;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{t("donations")}</p>
              <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{donationCount ?? 0}</p>
            </article>
            <article className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{t("certificates")}</p>
              <p className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{certificateCount ?? 0}</p>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
