"use client";

import { useState } from "react";

type CertificateShareButtonProps = {
  certificateNumber: string;
  certificateUrl: string;
  labels: {
    share: string;
    shared: string;
    copyLink: string;
  };
};

export function CertificateShareButton({
  certificateNumber,
  certificateUrl,
  labels,
}: CertificateShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate ${certificateNumber}`,
          text: `My GitBook AI contribution certificate: ${certificateNumber}`,
          url: certificateUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(certificateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50"
      onClick={handleShare}
      type="button"
    >
      {copied ? labels.shared : labels.share}
    </button>
  );
}
