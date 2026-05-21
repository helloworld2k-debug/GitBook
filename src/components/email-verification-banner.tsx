"use client";

import { useEffect, useState } from "react";

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
  resendAfter?: string;
};

type EmailVerificationBannerProps = {
  callbackUrl: string;
  email: string;
  messages: EmailVerificationBannerMessages;
};

const STORAGE_KEY = "email-verification-banner-dismissed";
const COOLDOWN_KEY = "email-verification-resend-cooldown";

function getCooldownEnd(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(COOLDOWN_KEY);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  if (isNaN(parsed) || parsed < Date.now()) {
    localStorage.removeItem(COOLDOWN_KEY);
    return null;
  }
  return parsed;
}

function setCooldownEnd(timestamp: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOLDOWN_KEY, String(timestamp));
}

export function EmailVerificationBanner({ callbackUrl, email, messages }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(() => getCooldownEnd());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Countdown timer
  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        setCooldownUntil(null);
        setResendStatus("idle");
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [cooldownUntil]);

  if (dismissed) return null;

  async function handleResend() {
    if (resendStatus === "submitting" || remainingSeconds > 0) return;

    setResendStatus("submitting");
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        body: JSON.stringify({ callbackUrl, email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            setCooldownUntil(Date.now() + seconds * 1000);
            setCooldownEnd(Date.now() + seconds * 1000);
          }
        }
        setResendStatus("rate-limited");
      } else if (response.ok) {
        setResendStatus("sent");
        // Clear cooldown on successful send
        setCooldownUntil(null);
        localStorage.removeItem(COOLDOWN_KEY);
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  const isDisabled = resendStatus === "submitting" || remainingSeconds > 0;

  return (
    <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3" role="status">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">{messages.title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">{messages.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-amber-200/30 bg-amber-200/10 px-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDisabled}
              onClick={() => void handleResend()}
              type="button"
            >
              {resendStatus === "submitting" ? messages.resendSending :
               remainingSeconds > 0 && messages.resendAfter
                 ? messages.resendAfter.replace("{seconds}", String(remainingSeconds))
                 : messages.resendButton}
            </button>
          </div>
          {resendStatus === "sent" ? (
            <p className="mt-2 text-sm text-emerald-100">{messages.resendSent}</p>
          ) : null}
          {resendStatus === "rate-limited" ? (
            <p className="mt-2 text-sm text-amber-100">
              {remainingSeconds > 0 && messages.resendAfter
                ? messages.resendRateLimited.replace("{seconds}", String(remainingSeconds))
                : messages.resendRateLimited}
            </p>
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
