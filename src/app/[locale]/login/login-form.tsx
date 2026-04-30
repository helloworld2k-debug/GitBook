"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github" | "apple";
type AuthMode = "sign-in" | "register";
type FormStatus = "idle" | "submitting" | "success" | "error" | "password-mismatch" | "oauth-error";

export type LoginFormMessages = {
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  createAccount: string;
  email: string;
  emailPlaceholder: string;
  oauthError: string;
  password: string;
  passwordMismatch: string;
  passwordPlaceholder: string;
  providerButtons: Record<OAuthProvider, string>;
  providersLabel: string;
  registerTab: string;
  registrationSuccess: string;
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
};

const providerOrder: OAuthProvider[] = ["google", "github", "apple"];

export function LoginForm({ callbackUrl, messages, nextPath }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

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

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      setStatus(error ? "error" : "success");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      return;
    }

    window.location.assign(nextPath);
  }

  async function handleProviderSignIn(provider: OAuthProvider) {
    setStatus("submitting");
    setActiveProvider(provider);

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
  const isRegistering = mode === "register";
  const submitLabel = isRegistering ? messages.createAccount : messages.signInSubmit;
  const submittingLabel = isRegistering ? messages.signingUp : messages.signingIn;
  const errorMessage =
    status === "password-mismatch" ? messages.passwordMismatch : isRegistering ? messages.signUpError : messages.signInError;

  return (
    <div className="glass-panel rounded-lg p-5 sm:p-6">
      <form className="space-y-4" onSubmit={handlePasswordSubmit}>
        <div>
          <h2 className="text-base font-semibold text-white">{messages.title}</h2>
          <div className="mt-4 grid grid-cols-2 rounded-md border border-cyan-300/20 bg-slate-950/70 p-1">
            <button
              aria-pressed={!isRegistering}
              className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-300 transition-colors aria-pressed:bg-cyan-300/15 aria-pressed:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              onClick={() => {
                setMode("sign-in");
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
                setStatus("idle");
              }}
              type="button"
            >
              {messages.registerTab}
            </button>
          </div>
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
        </div>
        <button
          className="neon-button inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting && activeProvider === null ? submittingLabel : submitLabel}
        </button>
        {status === "success" ? (
          <p
            aria-live="polite"
            className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
            role="status"
          >
            {isRegistering ? messages.registrationSuccess : ""}
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
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-cyan-300/15" />
        <div className="h-px flex-1 bg-cyan-300/15" />
      </div>

      <fieldset aria-label={messages.providersLabel} className="m-0 grid min-w-0 gap-2 border-0 p-0">
        {providerOrder.map((provider) => (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-cyan-300/20 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-300/50 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            key={provider}
            onClick={() => void handleProviderSignIn(provider)}
            type="button"
          >
            {isSubmitting && activeProvider === provider ? messages.sending : messages.providerButtons[provider]}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
