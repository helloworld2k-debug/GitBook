"use client";

import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminStatusBadge } from "@/components/admin/admin-shell";
import { SupportFeedbackStatusForm } from "@/components/admin/support-feedback-status-form";
import { updateSupportFeedbackStatus } from "../actions";

type FeedbackStatus = "open" | "reviewing" | "closed";

type SupportFeedbackTableRowProps = {
  children?: ReactNode;
  contact: string | null;
  createdAt: string;
  email: string | null;
  feedbackId: string;
  initialStatus: FeedbackStatus;
  isUnread: boolean;
  locale: string;
  message: string;
  subject: string;
};

export async function SupportFeedbackTableRow({
  children,
  contact,
  createdAt,
  email,
  feedbackId,
  initialStatus,
  isUnread,
  locale,
  message,
  subject,
}: SupportFeedbackTableRowProps) {
  const t = await getTranslations("admin");

  const labels = {
    open: t("supportFeedback.statuses.open"),
    reviewing: t("supportFeedback.statuses.reviewing"),
    closed: t("supportFeedback.statuses.closed"),
    save: t("supportFeedback.save"),
    saving: t("common.saving"),
    confirmChange: t("supportFeedback.confirmChange"),
  };

  function statusTone(status: FeedbackStatus) {
    if (status === "closed") return "success";
    if (status === "reviewing") return "warning";
    return "neutral";
  }

  return (
    <tr className={isUnread ? "bg-rose-50/40" : ""}>
      <td className="min-w-56 px-5 py-4 font-medium text-slate-950">
        <Link className="underline-offset-4 hover:underline" href={`/admin/support-feedback/${feedbackId}`}>
          {subject}
        </Link>
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        {isUnread ? (
          <span className="inline-flex min-h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700">
            {t("supportFeedback.unread")}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
      <td className="min-w-56 px-5 py-4 text-slate-700">
        <span className="block">{email ?? "-"}</span>
        <span className="block text-xs text-slate-500">{contact ?? "-"}</span>
      </td>
      <td className="max-w-md px-5 py-4 text-slate-700">
        <p className="line-clamp-3 whitespace-pre-wrap break-words">{message}</p>
      </td>
      <td className="whitespace-nowrap px-5 py-4">
        <AdminStatusBadge tone={statusTone(initialStatus)}>
          {labels[initialStatus]}
        </AdminStatusBadge>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
        {createdAt}
      </td>
      <td className="border-l border-slate-200 px-5 py-4">
        {children}
        <SupportFeedbackStatusForm
          feedbackId={feedbackId}
          initialStatus={initialStatus}
          locale={locale}
          labels={labels}
          action={updateSupportFeedbackStatus}
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input name="return_to" type="hidden" value="/admin/support-feedback" />
          </div>
        </SupportFeedbackStatusForm>
        <Link className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" href={`/admin/support-feedback/${feedbackId}`}>
          {t("supportFeedback.view")}
        </Link>
      </td>
    </tr>
  );
}