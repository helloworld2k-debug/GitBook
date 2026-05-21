"use client";

import { useState } from "react";

type ResendStatus = "idle" | "submitting" | "sent" | "rate-limited" | "error";

type EmailVerificationBannerMessages = {
  description: string;
  dismiss: string;
  resendButton: string;
  resendError: string;
  resendRateLimited: string;
  resendSending: string;
  resendSent: string;
  title: string;
};

type EmailVerificationBannerProps = {
  callbackUrl: string;
  email: string;
  messages: EmailVerificationBannerMessages;
};

const STORAGE_KEY = "email-verification-banner-dismissed";

export function EmailVerificationBanner({ callbackUrl, email, messages }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");

  if (dismissed) return null;

  async function handleResend() {
    setResendStatus("submitting");
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        body: JSON.stringify({ callbackUrl, email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setResendStatus(response.status === 429 ? "rate-limited" : response.ok ? "sent" : "error");
    } catch {
      setResendStatus("error");
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3" role="status">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">{messages.title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">{messages.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10 px-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resendStatus === "submitting"}
              onClick={() => void handleResend()}
              type="button"
            >
              {resendStatus === "submitting" ? messages.resendSending : messages.resendButton}
            </button>
          </div>
          {resendStatus === "sent" ? (
            <p className="mt-2 text-sm text-emerald-100">{messages.resendSent}</p>
          ) : null}
          {resendStatus === "rate-limited" ? (
            <p className="mt-2 text-sm text-amber-100">{messages.resendRateLimited}</p>
          ) : null}
          {resendStatus === "error" ? (
            <p className="mt-2 text-sm text-red-100">{messages.resendError}</p>
          ) : null}
        </div>
        <button
          aria-label={messages.dismiss}
          className="shrink-0 rounded-md p-1 text-amber-100/60 transition-colors hover:text-amber-100"
          onClick={handleDismiss}
          type="button"
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
