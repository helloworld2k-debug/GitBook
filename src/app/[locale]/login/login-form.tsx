"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github";
type AuthMode = "forgot-password" | "sign-in" | "register";
type FormStatus = "idle" | "submitting" | "success" | "error" | "password-mismatch" | "oauth-error" | "reset-sent" | "reset-error";

export type LoginFormMessages = {
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  createAccount: string;
  email: string;
  emailPlaceholder: string;
  humanVerificationError: string;
  humanVerificationLabel: string;
  oauthError: string;
  password: string;
  passwordMismatch: string;
  passwordPlaceholder: string;
  passwordResetBack: string;
  passwordResetError: string;
  passwordResetMode: string;
  passwordResetSent: string;
  passwordResetSubmit: string;
  passwordResetTitle: string;
  providerButtons: Record<OAuthProvider, string>;
  providersLabel: string;
  registerTab: string;
  registrationSuccess: string;
  registrationRateLimited: string;
  signInSubmit: string;
  signInTab: string;
  signingIn: string;
  signingUp: string;
  signInError: string;
  signUpError: string;
  sending: string;
  title: string;
};

type LoginFormProps = {
  callbackUrl: string;
  messages: LoginFormMessages;
  nextPath: string;
  passwordResetCallbackUrl: string;
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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.22c0 4.51 2.87 8.33 6.84 9.68.5.09.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.37 9.37 0 0 1 12 6.92c.85 0 1.7.12 2.5.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.04.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49A10.23 10.23 0 0 0 22 12.22C22 6.58 17.52 2 12 2z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  return provider === "google" ? <GoogleIcon /> : <GitHubIcon />;
}

export function LoginForm({ callbackUrl, messages, nextPath, passwordResetCallbackUrl, turnstileSiteKey }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if ((mode !== "register" && !captchaRequired) || !turnstileSiteKey || !turnstileRef.current) {
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
  }, [captchaRequired, mode, turnstileSiteKey]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setActiveProvider(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (mode === "register") {
      const confirmPassword = String(formData.get("confirm-password") ?? "");

      if (password !== confirmPassword) {
        setStatus("password-mismatch");
        return;
      }

      if (turnstileSiteKey && !turnstileToken) {
        setStatus("error");
        return;
      }

      const response = await fetch("/api/auth/register", {
        body: JSON.stringify({
          callbackUrl,
          email,
          password,
          ...(turnstileSiteKey ? { turnstileToken } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (response.status === 429) {
        setStatus("error");
        return;
      }

      const result = await response.json() as { error?: string; ok?: boolean };

      if (!response.ok || !result.ok) {
        setStatus("error");
        return;
      }

      setStatus("success");
      return;
    }

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
  }

  async function handlePasswordResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setActiveProvider(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setStatus("reset-error");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetCallbackUrl,
    });

    setStatus(error ? "reset-error" : "reset-sent");
  }

  async function handleProviderSignIn(provider: OAuthProvider) {
    setStatus("submitting");
    setActiveProvider(provider);
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setStatus("oauth-error");
      setActiveProvider(null);
      return;
    }

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
  }

  const isSubmitting = status === "submitting";
  const isResettingPassword = mode === "forgot-password";
  const isRegistering = mode === "register";
  const submitLabel = isRegistering ? messages.createAccount : messages.signInSubmit;
  const submittingLabel = isRegistering ? messages.signingUp : messages.signingIn;
  const passwordSubmitLabel = isSubmitting && activeProvider === null ? submittingLabel : submitLabel;
  const errorMessage =
    status === "password-mismatch"
      ? messages.passwordMismatch
      : captchaRequired && turnstileSiteKey
        ? messages.humanVerificationError
        : isRegistering && turnstileSiteKey && !turnstileToken
          ? messages.humanVerificationError
          : isRegistering
            ? messages.signUpError
            : messages.signInError;

  return (
    <div className="glass-panel rounded-lg p-5 sm:p-6">
      <form className="space-y-4" onSubmit={isResettingPassword ? handlePasswordResetSubmit : handlePasswordSubmit}>
        <div>
          <h2 className="text-base font-semibold text-white">{isResettingPassword ? messages.passwordResetTitle : messages.title}</h2>
          {isResettingPassword ? null : (
            <div className="mt-4 grid grid-cols-2 rounded-md border border-cyan-300/20 bg-slate-950/70 p-1">
              <button
                aria-pressed={!isRegistering}
                className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-300 transition-colors aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                onClick={() => {
                  setMode("sign-in");
                  setCaptchaRequired(false);
                  setStatus("idle");
                }}
                type="button"
              >
                {messages.signInTab}
              </button>
              <button
                aria-pressed={isRegistering}
                className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-300 transition-colors aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                onClick={() => {
                  setMode("register");
                  setCaptchaRequired(false);
                  setStatus("idle");
                }}
                type="button"
              >
                {messages.registerTab}
              </button>
            </div>
          )}
          <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="login-email">
            {messages.email}
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            id="login-email"
            name="email"
            placeholder={messages.emailPlaceholder}
            required
            type="email"
          />
          {isResettingPassword ? null : (
            <>
              <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="login-password">
                {messages.password}
              </label>
              <input
                autoComplete={isRegistering ? "new-password" : "current-password"}
                className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                id="login-password"
                name="password"
                placeholder={messages.passwordPlaceholder}
                required
                type="password"
              />
              {isRegistering ? (
                <>
                  <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="login-confirm-password">
                    {messages.confirmPassword}
                  </label>
                  <input
                    autoComplete="new-password"
                    className="mt-2 min-h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/70 px-3 text-base text-white shadow-sm outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                    id="login-confirm-password"
                    name="confirm-password"
                    placeholder={messages.confirmPasswordPlaceholder}
                    required
                    type="password"
                  />
                </>
              ) : null}
            </>
          )}
          {(isRegistering || captchaRequired) && turnstileSiteKey ? (
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-medium text-slate-200">{messages.humanVerificationLabel}</p>
              <div
                className="min-h-16 rounded-md border border-cyan-300/20 bg-slate-950/70 p-3"
                data-testid="turnstile-placeholder"
                ref={turnstileRef}
              />
            </div>
          ) : null}
        </div>
        <button
          className="neon-button inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isResettingPassword ? messages.passwordResetSubmit : passwordSubmitLabel}
        </button>
        {!isRegistering && !isResettingPassword ? (
          <button
            className="text-sm font-medium text-cyan-100 underline-offset-4 hover:text-cyan-50 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={() => {
              setMode("forgot-password");
              setStatus("idle");
            }}
            type="button"
          >
            {messages.passwordResetMode}
          </button>
        ) : null}
        {isResettingPassword ? (
          <button
            className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={() => {
              setMode("sign-in");
              setStatus("idle");
            }}
            type="button"
          >
            {messages.passwordResetBack}
          </button>
        ) : null}
        {status === "success" || status === "reset-sent" ? (
          <p
            aria-live="polite"
            className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
            role="status"
          >
            {status === "reset-sent" ? messages.passwordResetSent : isRegistering ? messages.registrationSuccess : ""}
          </p>
        ) : null}
        {status === "error" || status === "password-mismatch" ? (
          <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {status === "oauth-error" ? (
          <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
            {messages.oauthError}
          </p>
        ) : null}
        {status === "reset-error" ? (
          <p className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
            {messages.passwordResetError}
          </p>
        ) : null}
      </form>

      {isResettingPassword ? null : (
        <>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-cyan-300/15" />
            <div className="h-px flex-1 bg-cyan-300/15" />
          </div>

          <fieldset aria-label={messages.providersLabel} className="m-0 grid min-w-0 gap-2 border-0 p-0">
            {providerOrder.map((provider) => (
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-cyan-300/20 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-300/50 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                key={provider}
                onClick={() => void handleProviderSignIn(provider)}
                type="button"
              >
                <ProviderIcon provider={provider} />
                {isSubmitting && activeProvider === provider ? messages.sending : messages.providerButtons[provider]}
              </button>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}
