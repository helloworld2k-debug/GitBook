"use client";

import { downloadAsCsv } from "@/lib/admin/export";
import { useState } from "react";

type Donation = {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  provider_transaction_id: string;
  paid_at: string | null;
  created_at: string;
};

type AdminDonationExportProps = {
  donations: Donation[];
  locale: string;
  labels: {
    export: string;
    exported?: string;
    exporting: string;
  };
  providerLabels: Record<string, string>;
  statusLabels: Record<string, string>;
};

export function AdminDonationExport({
  donations,
  locale,
  labels,
  providerLabels,
  statusLabels,
}: AdminDonationExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Format data for CSV export
      const formattedData = donations.map((item) => ({
        id: item.id,
        provider: providerLabels[item.provider] || item.provider,
        status: statusLabels[item.status] || item.status,
        amount: new Intl.NumberFormat(locale, {
          style: "currency",
          currency: item.currency.toUpperCase(),
        }).format(item.amount / 100),
        currency: item.currency.toUpperCase(),
        provider_transaction_id: item.provider_transaction_id,
        paid_at: item.paid_at
          ? new Intl.DateTimeFormat(locale, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(item.paid_at))
          : "",
        created_at: new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.created_at)),
      }));

      downloadAsCsv(formattedData, `donations_${new Date().toISOString().split("T")[0]}`);
      setStatusMessage(labels.exported ?? "Export complete.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <span className="inline-grid gap-2">
      <button
        aria-busy={isExporting}
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isExporting || donations.length === 0}
        onClick={handleExport}
        type="button"
      >
        {isExporting ? labels.exporting : labels.export}
      </button>
      {statusMessage ? (
        <span aria-live="polite" className="text-xs font-medium text-emerald-700" role="status">
          {statusMessage}
        </span>
      ) : null}
    </span>
  );
}
