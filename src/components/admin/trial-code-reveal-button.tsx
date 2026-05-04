"use client";

import { useState, useTransition } from "react";
import { revealLicenseCode } from "@/app/[locale]/admin/actions";

type TrialCodeRevealButtonProps = {
  errorLabel: string;
  hideLabel: string;
  locale: string;
  revealLabel: string;
  trialCodeId: string;
};

export function TrialCodeRevealButton({
  errorLabel,
  hideLabel,
  locale,
  revealLabel,
  trialCodeId,
}: TrialCodeRevealButtonProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (code) {
      setCode(null);
      setError(null);
      return;
    }

    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("trial_code_id", trialCodeId);
    startTransition(async () => {
      try {
        const result = await revealLicenseCode(formData);
        setCode(result.code);
        setError(null);
      } catch {
        setError(errorLabel);
      }
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {code ? hideLabel : revealLabel}
      </button>
      {code ? (
        <code className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-xs font-semibold text-amber-900">
          {code}
        </code>
      ) : null}
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
