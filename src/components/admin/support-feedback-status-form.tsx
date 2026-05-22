"use client";

import { useState, useTransition } from "react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

type FeedbackStatus = "open" | "reviewing" | "closed";

type SupportFeedbackStatusFormProps = {
  children: React.ReactNode;
  feedbackId: string;
  initialStatus: FeedbackStatus;
  locale: string;
  labels: {
    open: string;
    reviewing: string;
    closed: string;
    save: string;
    saving: string;
    confirmChange: string;
  };
  action: (formData: FormData) => void;
};

export function SupportFeedbackStatusForm({
  children,
  feedbackId,
  initialStatus,
  locale,
  labels,
  action,
}: SupportFeedbackStatusFormProps) {
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (selectedStatus === initialStatus) {
      return;
    }

    const confirmMessage = labels.confirmChange
      .replace("{old}", labels[initialStatus])
      .replace("{new}", labels[selectedStatus]);

    if (!confirm(confirmMessage)) {
      return;
    }

    startTransition(() => {
      action(formData);
    });
  };

  return (
    <form action={action} onSubmit={handleSubmit} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
      {children}
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/support-feedback" />
      <input name="feedback_id" type="hidden" value={feedbackId} />
      <input name="status" type="hidden" value={selectedStatus} />
      <div className="relative">
        <select
          className="min-h-10 min-w-0 appearance-none rounded-md border border-slate-300 bg-white px-2 pr-8 text-sm"
          disabled={isPending}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as FeedbackStatus)}
        >
          <option value="open">{labels.open}</option>
          <option value="reviewing">{labels.reviewing}</option>
          <option value="closed">{labels.closed}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg className="size-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <AdminSubmitButton
        className={`min-h-10 whitespace-nowrap rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 ${
          selectedStatus === initialStatus ? "cursor-not-allowed opacity-60" : ""
        }`}
        aria-label={isPending ? labels.saving : labels.save}
        pendingLabel={labels.saving}
      >
        {isPending ? labels.saving : labels.save}
      </AdminSubmitButton>
    </form>
  );
}
