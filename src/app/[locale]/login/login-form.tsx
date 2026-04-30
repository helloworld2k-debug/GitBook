"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OAuthProvider = "google" | "github" | "apple";
type FormStatus = "idle" | "submitting" | "success" | "error" | "oauth-error";

export type LoginFormMessages = {
  email: string;
  emailPlaceholder: string;
  magicLink: string;
  oauthError: string;
  providerButtons: Record<OAuthProvider, string>;
  providersLabel: string;
  sendLink: string;
  sending: string;
  submitError: string;
  success: string;
};

type LoginFormProps = {
  callbackUrl: string;
  messages: LoginFormMessages;
};

const providerOrder: OAuthProvider[] = ["google", "github", "apple"];

export function LoginForm({ callbackUrl, messages }: LoginFormProps) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setActiveProvider(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    setStatus(error ? "error" : "success");
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

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <form className="space-y-4" onSubmit={handleEmailSubmit}>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{messages.magicLink}</h2>
          <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="login-email">
            {messages.email}
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            id="login-email"
            name="email"
            placeholder={messages.emailPlaceholder}
            required
            type="email"
          />
        </div>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting && activeProvider === null ? messages.sending : messages.sendLink}
        </button>
        {status === "success" ? (
          <p
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            role="status"
          >
            {messages.success}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {messages.submitError}
          </p>
        ) : null}
        {status === "oauth-error" ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {messages.oauthError}
          </p>
        ) : null}
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-slate-200" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <fieldset aria-label={messages.providersLabel} className="m-0 grid min-w-0 gap-2 border-0 p-0">
        {providerOrder.map((provider) => (
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-950 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
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
