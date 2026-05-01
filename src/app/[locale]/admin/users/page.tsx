import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { unbindTrialMachine, updateUserAccountStatus, updateUserAdminRole } from "../actions";

type AdminUsersPageProps = {
  params: Promise<{ locale: string }>;
};

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "-";
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminUsersPage({ params }: AdminUsersPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin.users");
  const supabase = createSupabaseAdminClient();
  const [profilesResult, trialsResult, sessionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,display_name,admin_role,account_status,is_admin,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("trial_code_redemptions")
      .select("id,user_id,machine_code_hash,device_id,redeemed_at,trial_valid_until,bound_at")
      .order("redeemed_at", { ascending: false })
      .limit(200),
    supabase
      .from("desktop_sessions")
      .select("id,user_id,device_id,machine_code_hash,platform,app_version,last_seen_at,revoked_at")
      .order("last_seen_at", { ascending: false })
      .limit(200),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (trialsResult.error) throw trialsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const trialsByUser = new Map<string, NonNullable<typeof trialsResult.data>>();
  for (const trial of trialsResult.data ?? []) {
    const current = trialsByUser.get(trial.user_id) ?? [];
    current.push(trial);
    trialsByUser.set(trial.user_id, current);
  }

  const sessionsByUser = new Map<string, NonNullable<typeof sessionsResult.data>>();
  for (const session of sessionsResult.data ?? []) {
    const current = sessionsByUser.get(session.user_id) ?? [];
    current.push(session);
    sessionsByUser.set(session.user_id, current);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
          </div>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("user")}</th>
                    <th className="px-5 py-3">{t("role")}</th>
                    <th className="px-5 py-3">{t("status")}</th>
                    <th className="px-5 py-3">{t("trials")}</th>
                    <th className="px-5 py-3">{t("devices")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(profilesResult.data ?? []).map((profile) => {
                    const trials = trialsByUser.get(profile.id) ?? [];
                    const sessions = sessionsByUser.get(profile.id) ?? [];

                    return (
                      <tr key={profile.id}>
                        <td className="min-w-64 px-5 py-4 align-top">
                          <p className="font-medium text-slate-950">{profile.email}</p>
                          <p className="mt-1 text-slate-600">{profile.display_name ?? "-"}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{profile.id}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <form action={updateUserAdminRole} className="flex gap-2">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="user_id" type="hidden" value={profile.id} />
                            <select className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="admin_role" defaultValue={profile.admin_role ?? (profile.is_admin ? "owner" : "user")}>
                              <option value="user">{t("roles.user")}</option>
                              <option value="operator">{t("roles.operator")}</option>
                              <option value="owner">{t("roles.owner")}</option>
                            </select>
                            <button className="rounded-md border border-slate-300 px-3 text-sm font-medium" type="submit">
                              {t("save")}
                            </button>
                          </form>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <form action={updateUserAccountStatus} className="flex gap-2">
                            <input name="locale" type="hidden" value={locale} />
                            <input name="user_id" type="hidden" value={profile.id} />
                            <select className="min-h-10 rounded-md border border-slate-300 px-2 text-sm" name="account_status" defaultValue={profile.account_status ?? "active"}>
                              <option value="active">{t("statuses.active")}</option>
                              <option value="disabled">{t("statuses.disabled")}</option>
                            </select>
                            <button className="rounded-md border border-slate-300 px-3 text-sm font-medium" type="submit">
                              {t("save")}
                            </button>
                          </form>
                        </td>
                        <td className="min-w-80 px-5 py-4 align-top">
                          {trials.length > 0 ? (
                            <div className="space-y-3">
                              {trials.map((trial) => (
                                <div key={trial.id} className="rounded-md border border-slate-200 p-3">
                                  <p className="font-medium text-slate-950">
                                    {trial.bound_at ? t("bound") : t("unbound")}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {t("redeemed")}: {formatDate(trial.redeemed_at, locale)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {t("validUntil")}: {formatDate(trial.trial_valid_until, locale)}
                                  </p>
                                  <p className="mt-1 font-mono text-xs text-slate-600">
                                    {t("machine")}: {shortHash(trial.machine_code_hash)}
                                  </p>
                                  {trial.machine_code_hash ? (
                                    <form action={unbindTrialMachine} className="mt-2">
                                      <input name="locale" type="hidden" value={locale} />
                                      <input name="trial_redemption_id" type="hidden" value={trial.id} />
                                      <button className="text-sm font-semibold text-red-700" type="submit">
                                        {t("unbind")}
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">{t("emptyTrials")}</span>
                          )}
                        </td>
                        <td className="min-w-80 px-5 py-4 align-top">
                          {sessions.length > 0 ? (
                            <div className="space-y-3">
                              {sessions.map((session) => (
                                <div key={session.id} className="rounded-md border border-slate-200 p-3">
                                  <p className="font-medium text-slate-950">{session.device_id}</p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {session.platform} {session.app_version ?? ""}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {t("lastSeen")}: {formatDate(session.last_seen_at, locale)}
                                  </p>
                                  <p className="mt-1 font-mono text-xs text-slate-600">
                                    {t("machine")}: {shortHash(session.machine_code_hash)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">{t("emptyDevices")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
