import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { DEFAULT_POLICY_PAGES, type PolicyPageContent } from "@/lib/policies/defaults";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updatePolicyPage } from "../actions";

type AdminPoliciesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

async function getPolicyRows() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: rows } = await supabase
      .from("policy_pages")
      .select("slug,title,summary,body,updated_at,sort_order")
      .order("sort_order", { ascending: true });

    return rows && rows.length > 0 ? (rows as PolicyPageContent[]) : DEFAULT_POLICY_PAGES;
  } catch {
    return DEFAULT_POLICY_PAGES;
  }
}

export default async function AdminPoliciesPage({ params, searchParams }: AdminPoliciesPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/policies`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/policies");
  const policyRows = await getPolicyRows();

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("policies.description")}
          eyebrow={t("policies.eyebrow")}
          title={t("policies.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <div className="grid gap-5">
          {policyRows.map((policy) => (
            <AdminCard className="p-5" key={policy.slug}>
              <form action={updatePolicyPage} className="grid gap-4">
                <input name="locale" type="hidden" value={locale} />
                <input name="return_to" type="hidden" value="/admin/policies" />
                <input name="slug" type="hidden" value={policy.slug} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">{policy.slug}</p>
                    {policy.updated_at ? <p className="mt-1 text-xs text-slate-500">{t("policies.updatedAt", { date: policy.updated_at })}</p> : null}
                  </div>
                  <a
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    href={`/en/policies/${policy.slug}`}
                    target="_blank"
                  >
                    {t("policies.viewPublic")}
                  </a>
                </div>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("policies.titleLabel")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={policy.title} maxLength={120} name="title" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("policies.summary")}
                  <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" defaultValue={policy.summary} maxLength={400} name="summary" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("policies.body")}
                  <textarea className="min-h-72 rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" defaultValue={policy.body} maxLength={8000} name="body" />
                </label>
                <div>
                  <AdminSubmitButton className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.saving")}>
                    {t("policies.save")}
                  </AdminSubmitButton>
                </div>
              </form>
            </AdminCard>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
