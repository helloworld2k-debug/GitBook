"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminFeedbackTone } from "@/lib/admin/feedback";

type AdminFeedbackToastProps = {
  message: string;
  tone: AdminFeedbackTone;
};

export function AdminFeedbackToast({ message, tone }: AdminFeedbackToastProps) {
  const isError = tone === "error";

  return <VisibleAdminFeedbackToast isError={isError} message={message} />;
}

function VisibleAdminFeedbackToast({ isError, message }: Pick<AdminFeedbackToastProps, "message"> & { isError: boolean }) {
  const [visible, setVisible] = useState(true);
  const Icon = isError ? XCircle : CheckCircle2;
  const toneClass = isError
    ? "border-red-200 bg-red-50 text-red-900 shadow-red-950/10"
    : "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-950/10";
  const iconClass = isError ? "text-red-600" : "text-emerald-600";

  useEffect(() => {
    if (isError) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setVisible(false), 4000);

    return () => window.clearTimeout(timeoutId);
  }, [isError]);

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 top-20 z-50 flex justify-center md:inset-x-auto md:right-6 md:top-20 md:block">
      <div
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border px-4 py-3 text-sm font-medium shadow-lg ${toneClass}`}
        role={isError ? "alert" : "status"}
      >
        <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
        <p className="min-w-0 flex-1 leading-6">{message}</p>
        <button
          aria-label="Dismiss feedback"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-current transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          onClick={() => setVisible(false)}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
