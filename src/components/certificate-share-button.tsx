"use client";

import { useState } from "react";

type CertificateShareButtonProps = {
  certificateNumber: string;
  certificateUrl: string;
  labels: {
    share: string;
    shared: string;
    copyLink: string;
    shareError?: string;
  };
};

export function CertificateShareButton({
  certificateNumber,
  certificateUrl,
  labels,
}: CertificateShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleShare = async () => {
    setError(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate ${certificateNumber}`,
          text: `My GitBook AI contribution certificate: ${certificateNumber}`,
          url: certificateUrl,
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError(true);
      }
    } else {
      try {
        await navigator.clipboard.writeText(certificateUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError(true);
      }
    }
  };

  return (
    <span className="inline-grid gap-2">
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50"
        onClick={handleShare}
        type="button"
      >
        {copied ? labels.shared : labels.share}
      </button>
      {copied ? (
        <span aria-live="polite" className="text-xs font-medium text-emerald-700" role="status">
          {labels.shared}
        </span>
      ) : null}
      {error ? (
        <span aria-live="assertive" className="text-xs font-medium text-red-700" role="alert">
          {labels.shareError ?? "Unable to share."}
        </span>
      ) : null}
    </span>
  );
}
