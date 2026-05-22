"use client";

import { downloadAsCsv, flattenDataForExport } from "@/lib/admin/export";
import { useState } from "react";

type ExportButtonProps<T extends Record<string, unknown>> = {
  data: T[];
  filename: string;
  formatters?: Partial<Record<keyof T, (value: unknown) => string>>;
  labels: {
    export: string;
    exported?: string;
    exporting: string;
  };
};

export function AdminExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  formatters,
  labels,
}: ExportButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      const flattened = flattenDataForExport(data, formatters);
      downloadAsCsv(flattened, filename);
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
        disabled={isExporting || data.length === 0}
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
