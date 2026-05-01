import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { getLocaleDashboardPath, sanitizeNextPath } from "@/lib/auth/guards";
import { LoginForm, type LoginFormMessages } from "./login-form";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string;
    next?: string | string[];
    password?: string;
  }>;
};

function getCallbackUrl(nextPath: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  return callbackUrl.toString();
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  const query = await searchParams;
  const t = await getTranslations("login");
  const nextPath = sanitizeNextPath(query.next, getLocaleDashboardPath(locale));
  const providerNames = {
    apple: t("apple"),
    github: t("github"),
    google: t("google"),
  };
  const messages: LoginFormMessages = {
    confirmPassword: t("confirmPassword"),
    confirmPasswordPlaceholder: t("confirmPasswordPlaceholder"),
    createAccount: t("createAccount"),
    email: t("email"),
    emailPlaceholder: t("emailPlaceholder"),
    oauthError: t("oauthError"),
    password: t("password"),
    passwordMismatch: t("passwordMismatch"),
    passwordPlaceholder: t("passwordPlaceholder"),
    passwordResetBack: t("passwordResetBack"),
    passwordResetError: t("passwordResetError"),
    passwordResetMode: t("passwordResetMode"),
    passwordResetSent: t("passwordResetSent"),
    passwordResetSubmit: t("passwordResetSubmit"),
    passwordResetTitle: t("passwordResetTitle"),
    providerButtons: {
      apple: t("continueWithProvider", { provider: providerNames.apple }),
      github: t("continueWithProvider", { provider: providerNames.github }),
      google: t("continueWithProvider", { provider: providerNames.google }),
    },
    providersLabel: t("providersLabel"),
    registerTab: t("registerTab"),
    registrationSuccess: t("registrationSuccess"),
    signInSubmit: t("signInSubmit"),
    signInTab: t("signInTab"),
    signingIn: t("signingIn"),
    signingUp: t("signingUp"),
    signInError: t("signInError"),
    signUpError: t("signUpError"),
    sending: t("sending"),
    title: t("formTitle"),
  };

  return (
    <>
      <SiteHeader />
      <main className="tech-shell flex-1">
        <section className="mx-auto grid min-h-[calc(100dvh-76px)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,440px)]">
          <div className="max-w-xl">
            <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-4xl">{t("title")}</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">{t("subtitle")}</p>
            <div className="mt-6 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              {t("privacyNote")}
            </div>
          </div>
          <div>
            {query.error ? (
              <p className="mb-3 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
                {t("callbackError")}
              </p>
            ) : null}
            {query.password === "reset" ? (
              <p
                className="mb-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
                role="status"
              >
                {t("passwordResetComplete")}
              </p>
            ) : null}
            <LoginForm callbackUrl={getCallbackUrl(nextPath)} messages={messages} nextPath={nextPath} />
          </div>
        </section>
      </main>
    </>
  );
}
