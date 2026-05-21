"use client";

import { downloadAsCsv, flattenDataForExport } from "@/lib/admin/export";
import { useState } from "react";

type ExportButtonProps<T extends Record<string, unknown>> = {
  data: T[];
  filename: string;
  formatters?: Partial<Record<keyof T, (value: unknown) => string>>;
  labels: {
    export: string;
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      const flattened = flattenDataForExport(data, formatters);
      downloadAsCsv(flattened, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={isExporting || data.length === 0}
      onClick={handleExport}
      type="button"
    >
      {isExporting ? labels.exporting : labels.export}
    </button>
  );
}
