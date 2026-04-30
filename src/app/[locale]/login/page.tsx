import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { defaultLocale, supportedLocales, type Locale } from "@/config/site";
import { sanitizeNextPath } from "@/lib/auth/guards";
import { LoginForm, type LoginFormMessages } from "./login-form";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string;
    next?: string;
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
  const nextPath = sanitizeNextPath(query.next, `/${defaultLocale}/dashboard`);
  const providerNames = {
    apple: t("apple"),
    github: t("github"),
    google: t("google"),
  };
  const messages: LoginFormMessages = {
    email: t("email"),
    emailPlaceholder: t("emailPlaceholder"),
    magicLink: t("magicLink"),
    oauthError: t("oauthError"),
    providerButtons: {
      apple: t("continueWithProvider", { provider: providerNames.apple }),
      github: t("continueWithProvider", { provider: providerNames.github }),
      google: t("continueWithProvider", { provider: providerNames.google }),
    },
    providersLabel: t("providersLabel"),
    sendLink: t("sendLink"),
    sending: t("sending"),
    submitError: t("submitError"),
    success: t("success"),
  };

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto grid min-h-[calc(100dvh-76px)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,440px)]">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase text-slate-500">{t("eyebrow")}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{t("title")}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">{t("subtitle")}</p>
            <div className="mt-6 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              {t("privacyNote")}
            </div>
          </div>
          <div>
            {query.error ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {t("callbackError")}
              </p>
            ) : null}
            <LoginForm callbackUrl={getCallbackUrl(nextPath)} messages={messages} />
          </div>
        </section>
      </main>
    </>
  );
}
