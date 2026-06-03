"use client";

import { useState, useTransition } from "react";
import { revealLicenseCodeBatch } from "@/app/[locale]/admin/actions";

type RevealedBatchCode = {
  code: string;
  codeMask: string | null;
  deletedAt: string | null;
  id: string;
  isActive: boolean;
  redemptionCount: number;
};

type LicenseCodeBatchRevealPanelProps = {
  batchId: string;
  labels: {
    batchPlaintextLabel: string;
    copied: string;
    copyAll: string;
    hideBatch: string;
    revealBatch: string;
    revealBatchError: string;
  };
  locale: string;
};

export function LicenseCodeBatchRevealPanel({ batchId, labels, locale }: LicenseCodeBatchRevealPanelProps) {
  const [codes, setCodes] = useState<RevealedBatchCode[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const plaintext = codes.map((code) => code.code).join("\n");

  function handleReveal() {
    if (codes.length > 0) {
      setCodes([]);
      setCopied(false);
      setError(null);
      return;
    }

    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("batch_id", batchId);
    startTransition(async () => {
      try {
        const result = await revealLicenseCodeBatch(formData);
        setCodes(result.codes);
        setCopied(false);
        setError(null);
      } catch {
        setError(labels.revealBatchError);
      }
    });
  }

  async function handleCopy() {
    if (!plaintext) return;

    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setError(null);
    } catch {
      setError(labels.revealBatchError);
    }
  }

  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-10 w-fit items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-950 transition-colors hover:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={handleReveal}
          type="button"
        >
          {codes.length > 0 ? labels.hideBatch : labels.revealBatch}
        </button>
        {codes.length > 0 ? (
          <button
            className="inline-flex min-h-10 w-fit items-center rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-950 transition-colors hover:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            onClick={handleCopy}
            type="button"
          >
            {copied ? labels.copied : labels.copyAll}
          </button>
        ) : null}
      </div>
      {codes.length > 0 ? (
        <textarea
          aria-label={labels.batchPlaintextLabel}
          className="mt-3 min-h-32 w-full resize-y rounded-md border border-amber-200 bg-white p-3 font-mono text-xs leading-5 text-slate-950 shadow-inner focus:border-amber-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          readOnly
          value={plaintext}
        />
      ) : null}
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
