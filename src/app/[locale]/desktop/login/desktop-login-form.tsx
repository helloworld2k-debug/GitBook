"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";
type FormStatus = "idle" | "submitting" | "error" | "oauth-error";

type DesktopLoginFormProps = {
  callbackUrl: string;
  nextPath: string;
  turnstileSiteKey?: string;
};

declare global {
  interface Window {
    turnstile?: {
      remove: (widgetId: string) => void;
      render: (container: HTMLElement, options: { callback?: (token: string) => void; sitekey: string }) => string;
    };
  }
}

const providerOrder: OAuthProvider[] = ["google", "github"];

const providerLabels: Record<OAuthProvider, string> = {
  github: "GitHub",
  google: "Google",
};

export function DesktopLoginForm({ callbackUrl, nextPath, turnstileSiteKey }: DesktopLoginFormProps) {
  const t = useTranslations("login");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!captchaRequired || !turnstileSiteKey || !turnstileRef.current) {
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const mountTurnstile = () => {
      if (cancelled || !turnstileRef.current || turnstileWidgetId.current) {
        return;
      }

      if (!window.turnstile) {
        pollTimer = setTimeout(mountTurnstile, 250);
        return;
      }

      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        callback: (token) => {
          setTurnstileToken(token);
        },
        sitekey: turnstileSiteKey,
      });
    };

    mountTurnstile();

    return () => {
      cancelled = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
      setTurnstileToken(null);
    };
  }, [captchaRequired, turnstileSiteKey]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setActiveProvider(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      if (captchaRequired && turnstileSiteKey && !turnstileToken) {
        setStatus("error");
        return;
      }

      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email,
          password,
          ...(captchaRequired && turnstileSiteKey ? { turnstileToken } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json() as { error?: string; ok?: boolean };

      if (result.error === "captcha_required") {
        setCaptchaRequired(true);
        setTurnstileToken(null);
        setStatus("error");
        return;
      }

      if (!response.ok || !result.ok) {
        setStatus("error");
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setStatus("error");
    }
  }

  async function handleProviderSignIn(provider: OAuthProvider) {
    setStatus("submitting");
    setActiveProvider(provider);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        setStatus("oauth-error");
        setActiveProvider(null);
      }
    } catch {
      setStatus("oauth-error");
      setActiveProvider(null);
    }
  }

  const isSubmitting = status === "submitting";

  return (
    <div className="rounded-lg border border-cyan-300/20 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/30 sm:p-6">
      <form className="space-y-4" onSubmit={handlePasswordSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="desktop-login-email">
            {t("email")}
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            id="desktop-login-email"
            name="email"
            placeholder={t("emailPlaceholder")}
            required
            type="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="desktop-login-password">
            {t("password")}
          </label>
          <input
            autoComplete="current-password"
            className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            id="desktop-login-password"
            name="password"
            placeholder={t("passwordPlaceholder")}
            required
            type="password"
          />
        </div>
        <button
          className="neon-button inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting && activeProvider === null ? t("signingIn") : t("signInSubmit")}
        </button>
        {captchaRequired && turnstileSiteKey ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-200">{t("humanVerificationLabel")}</p>
            <div
              className="min-h-16 rounded-md border border-cyan-300/20 bg-slate-950/70 p-3"
              data-testid="turnstile-placeholder"
              ref={turnstileRef}
            />
          </div>
        ) : null}
        {status === "error" ? (
          <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
            {captchaRequired ? t("humanVerificationError") : t("signInError")}
          </p>
        ) : null}
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-cyan-300/15" />
        <div className="h-px flex-1 bg-cyan-300/15" />
      </div>

      <fieldset aria-label={t("providersLabel")} className="m-0 grid min-w-0 gap-2 border-0 p-0">
        {providerOrder.map((provider) => (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-cyan-300/20 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-300/50 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            key={provider}
            onClick={() => void handleProviderSignIn(provider)}
            type="button"
          >
            {isSubmitting && activeProvider === provider ? t("sending") : t("continueWithProvider", { provider: providerLabels[provider] })}
          </button>
        ))}
      </fieldset>
      {status === "oauth-error" ? (
        <p className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
          {t("oauthError")}
        </p>
      ) : null}
    </div>
  );
}
