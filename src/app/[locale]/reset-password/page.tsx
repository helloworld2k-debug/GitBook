import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { KeyRound } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { updateResetPassword } from "./actions";

type ResetPasswordPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;
  const query = await searchParams;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("resetPassword");
  const updatePassword = updateResetPassword.bind(null, locale);

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <section className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-xl items-center px-4 py-10 sm:px-6">
          <div className="glass-panel w-full rounded-lg p-5 sm:p-6">
            <p className="inline-flex min-h-8 items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100">
              <KeyRound aria-hidden="true" className="size-4" />
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal text-white">{t("title")}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t("subtitle")}</p>
            <form action={updatePassword} className="mt-6 space-y-4">
              {query?.status === "mismatch" ? (
                <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
                  {t("mismatch")}
                </p>
              ) : null}
              {query?.status === "error" ? (
                <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
                  {t("error")}
                </p>
              ) : null}
              <label className="block text-sm font-medium text-slate-200" htmlFor="reset-password">
                {t("newPassword")}
              </label>
              <input
                autoComplete="new-password"
                className="min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                id="reset-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
              <label className="block text-sm font-medium text-slate-200" htmlFor="reset-confirm-password">
                {t("confirmPassword")}
              </label>
              <input
                autoComplete="new-password"
                className="min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                id="reset-confirm-password"
                minLength={8}
                name="confirm_password"
                required
                type="password"
              />
              <button
                className="neon-button inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                type="submit"
              >
                {t("submit")}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
