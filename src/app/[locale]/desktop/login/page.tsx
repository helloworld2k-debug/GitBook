import { resolvePageLocale } from "@/lib/i18n/page-locale";
import { DesktopLoginForm } from "./desktop-login-form";

type DesktopLoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string;
    next?: string | string[];
  }>;
};

function getCallbackUrl(nextPath: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  return callbackUrl.toString();
}

export function sanitizeDesktopAuthorizeNextPath(nextPath: string | string[] | null | undefined, locale: string) {
  const path = Array.isArray(nextPath) ? nextPath[0] : nextPath;
  const fallbackPath = `/${locale}/desktop/authorize`;

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallbackPath;
  }

  if (path.includes("\\") || path.includes("\n")) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(path, "https://gitbookai.local");

    if (parsed.origin !== "https://gitbookai.local") {
      return fallbackPath;
    }

    if (parsed.pathname !== `/${locale}/desktop/authorize`) {
      return fallbackPath;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallbackPath;
  }
}

export default async function DesktopLoginPage({ params, searchParams }: DesktopLoginPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);
  const query = await searchParams;
  const nextPath = sanitizeDesktopAuthorizeNextPath(query.next, locale);
  const hasAuthorizeError = query.error === "desktop_authorize_failed";

  return (
    <main className="tech-shell flex-1">
      <section className="mx-auto grid min-h-[calc(100dvh-76px)] max-w-3xl items-center px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
            Desktop authorization
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-white">Sign in to GitBook AI</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            After sign-in, this browser will return to the GitBook AI desktop app.
          </p>
          {hasAuthorizeError ? (
            <p className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
              Desktop authorization could not be prepared. Please sign in again.
            </p>
          ) : null}
          <div className="mt-6">
            <DesktopLoginForm callbackUrl={getCallbackUrl(nextPath)} nextPath={nextPath} />
          </div>
        </div>
      </section>
    </main>
  );
}
