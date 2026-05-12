import { getTranslations } from "next-intl/server";
import { AdminCard, AdminFeedbackBanner, AdminPageHeader, AdminShell, AdminStatusBadge } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getAdminShellProps } from "@/lib/admin/shell";
import { setupAdminPage } from "@/lib/auth/page-guards";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRegistrationBlock, revokeRegistrationBlock } from "../actions";

type AdminRegistrationSecurityPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

type RegistrationAttempt = {
  id: string;
  email_normalized: string;
  email_domain: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type RegistrationBlock = {
  id: string;
  scope: "domain" | "email" | "ip";
  scope_value: string;
  reason: string;
  blocked_until: string;
  created_at: string;
};

function summarize<T extends string | null>(
  attempts: RegistrationAttempt[],
  key: (attempt: RegistrationAttempt) => T,
) {
  const groups = new Map<string, { lastSeen: string; total: number; uniqueEmails: Set<string> }>();

  for (const attempt of attempts) {
    const rawKey = key(attempt) ?? "-";
    const current = groups.get(rawKey) ?? { lastSeen: attempt.created_at, total: 0, uniqueEmails: new Set<string>() };
    current.total += 1;
    current.uniqueEmails.add(attempt.email_normalized);
    if (new Date(attempt.created_at).getTime() > new Date(current.lastSeen).getTime()) {
      current.lastSeen = attempt.created_at;
    }
    groups.set(rawKey, current);
  }

  return [...groups.entries()]
    .map(([value, item]) => ({
      lastSeen: item.lastSeen,
      total: item.total,
      uniqueEmails: item.uniqueEmails.size,
      value,
    }))
    .sort((a, b) => b.total - a.total || new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 10);
}

async function getRegistrationSecurityData() {
  const supabase = createSupabaseAdminClient();
  const [{ data: attempts, error: attemptsError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase
      .from("registration_attempts")
      .select("id,email_normalized,email_domain,ip_address,user_agent,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("registration_blocks")
      .select("id,scope,scope_value,reason,blocked_until,created_at")
      .is("revoked_at", null)
      .gt("blocked_until", new Date().toISOString())
      .order("blocked_until", { ascending: false }),
  ]);

  if (attemptsError) throw attemptsError;
  if (blocksError) throw blocksError;

  return {
    attempts: (attempts ?? []) as RegistrationAttempt[],
    blocks: (blocks ?? []) as RegistrationBlock[],
  };
}

function HiddenLocale({ locale }: { locale: string }) {
  return <input name="locale" type="hidden" value={locale} />;
}

export default async function AdminRegistrationSecurityPage({ params, searchParams }: AdminRegistrationSecurityPageProps) {
  const { locale: localeParam } = await params;
  const feedback = await searchParams;
  const { locale } = await setupAdminPage(localeParam, `/${localeParam}/admin/registration-security`);
  const t = await getTranslations("admin");
  const shellProps = await getAdminShellProps(locale, "/admin/registration-security");
  const { attempts, blocks } = await getRegistrationSecurityData();
  const ipSummary = summarize(attempts, (attempt) => attempt.ip_address);
  const domainSummary = summarize(attempts, (attempt) => attempt.email_domain);

  const quickBlockForm = (scope: "domain" | "ip", value: string) => (
    <form action={createRegistrationBlock} className="mt-3 flex flex-wrap gap-2">
      <HiddenLocale locale={locale} />
      <input name="scope" type="hidden" value={scope} />
      <input name="scope_value" type="hidden" value={value} />
      <input name="reason" type="hidden" value={`Suspicious registration attempts from ${value}`} />
      <select className="min-h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-950" name="duration">
        <option value="1h">1h</option>
        <option value="24h">24h</option>
        <option value="7d">7d</option>
      </select>
      <AdminSubmitButton className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" pendingLabel={t("common.processing")}>
        {t("registrationSecurity.block")}
      </AdminSubmitButton>
    </form>
  );

  return (
    <AdminShell {...shellProps}>
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          backHref="/admin"
          backLabel={t("shell.backToAdmin")}
          description={t("registrationSecurity.description")}
          eyebrow="Admin"
          title={t("registrationSecurity.title")}
        />
        <AdminFeedbackBanner error={feedback?.error} notice={feedback?.notice} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5">
            <AdminCard className="p-5">
              <h2 className="text-base font-semibold text-slate-950">{t("registrationSecurity.ipSummary")}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {ipSummary.map((item) => (
                  <div className="rounded-md border border-slate-200 p-4" key={item.value}>
                    <p className="break-all font-mono text-sm font-semibold text-slate-950">{item.value}</p>
                    <p className="mt-2 text-sm text-slate-600">{t("registrationSecurity.totalAttempts")}: {item.total}</p>
                    <p className="text-sm text-slate-600">{t("registrationSecurity.uniqueEmails")}: {item.uniqueEmails}</p>
                    <p className="text-sm text-slate-600">{t("registrationSecurity.lastSeen")}: {formatDateTimeWithSeconds(item.lastSeen, locale)}</p>
                    {quickBlockForm("ip", item.value)}
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard className="p-5">
              <h2 className="text-base font-semibold text-slate-950">{t("registrationSecurity.domainSummary")}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {domainSummary.map((item) => (
                  <div className="rounded-md border border-slate-200 p-4" key={item.value}>
                    <p className="break-all font-mono text-sm font-semibold text-slate-950">{item.value}</p>
                    <p className="mt-2 text-sm text-slate-600">{t("registrationSecurity.totalAttempts")}: {item.total}</p>
                    <p className="text-sm text-slate-600">{t("registrationSecurity.uniqueEmails")}: {item.uniqueEmails}</p>
                    <p className="text-sm text-slate-600">{t("registrationSecurity.lastSeen")}: {formatDateTimeWithSeconds(item.lastSeen, locale)}</p>
                    {quickBlockForm("domain", item.value)}
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard className="p-5">
              <h2 className="text-base font-semibold text-slate-950">{t("registrationSecurity.recentAttempts")}</h2>
              {attempts.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {attempts.slice(0, 50).map((attempt) => (
                    <div className="grid gap-2 rounded-md border border-slate-200 p-4 md:grid-cols-[1fr_1fr_1fr]" key={attempt.id}>
                      <p className="break-all text-sm text-slate-950">{attempt.email_normalized}</p>
                      <p className="break-all font-mono text-sm text-slate-700">{attempt.ip_address ?? "-"}</p>
                      <p className="text-sm text-slate-600">{formatDateTimeWithSeconds(attempt.created_at, locale)}</p>
                      <p className="break-all text-xs text-slate-500 md:col-span-3">{attempt.user_agent ?? "-"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">{t("registrationSecurity.emptyAttempts")}</p>
              )}
            </AdminCard>
          </div>

          <div className="grid content-start gap-5">
            <AdminCard className="p-5">
              <h2 className="text-base font-semibold text-slate-950">{t("registrationSecurity.createBlock")}</h2>
              <form action={createRegistrationBlock} className="mt-4 grid gap-3">
                <HiddenLocale locale={locale} />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("registrationSecurity.scope")}
                  <select className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-950" name="scope" required>
                    <option value="ip">{t("registrationSecurity.ip")}</option>
                    <option value="email">{t("registrationSecurity.email")}</option>
                    <option value="domain">{t("registrationSecurity.domain")}</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("registrationSecurity.scopeValue")}
                  <input className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-950" maxLength={320} name="scope_value" required />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("registrationSecurity.blockedUntil")}
                  <select className="min-h-11 rounded-md border border-slate-300 px-3 text-slate-950" name="duration" required>
                    <option value="1h">1h</option>
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  {t("registrationSecurity.reason")}
                  <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-slate-950" maxLength={500} name="reason" required />
                </label>
                <AdminSubmitButton className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" pendingLabel={t("common.processing")}>
                  {t("registrationSecurity.block")}
                </AdminSubmitButton>
              </form>
            </AdminCard>

            <AdminCard className="p-5">
              <h2 className="text-base font-semibold text-slate-950">{t("registrationSecurity.activeBlocks")}</h2>
              {blocks.length > 0 ? (
                <div className="mt-4 grid gap-3">
                  {blocks.map((block) => (
                    <div className="rounded-md border border-slate-200 p-4" key={block.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone="warning">{block.scope}</AdminStatusBadge>
                        <p className="break-all font-mono text-sm font-semibold text-slate-950">{block.scope_value}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{t("registrationSecurity.blockedUntil")}: {formatDateTimeWithSeconds(block.blocked_until, locale)}</p>
                      <p className="mt-1 text-sm text-slate-600">{block.reason}</p>
                      <form action={revokeRegistrationBlock} className="mt-3 grid gap-2">
                        <HiddenLocale locale={locale} />
                        <input name="block_id" type="hidden" value={block.id} />
                        <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" maxLength={500} name="reason" placeholder={t("registrationSecurity.reason")} required />
                        <ConfirmActionButton className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" confirmLabel={t("registrationSecurity.revoke")} pendingLabel={t("common.processing")}>
                          {t("registrationSecurity.revoke")}
                        </ConfirmActionButton>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">{t("registrationSecurity.emptyBlocks")}</p>
              )}
            </AdminCard>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
