"use client";

import { AdminExportButton } from "./admin-export-button";

type Certificate = {
  id: string;
  certificate_number: string;
  type: string;
  status: string;
  issued_at: string | null;
};

type AdminCertificateExportProps = {
  certificates: Certificate[];
  locale: string;
  labels: {
    export: string;
    exporting: string;
  };
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
};

export function AdminCertificateExport({
  certificates,
  locale,
  labels,
  typeLabels,
  statusLabels,
}: AdminCertificateExportProps) {
  const formatIssuedAt = (value: unknown) => {
    if (!value) return "";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value as string));
  };

  const formatters = {
    type: (value: unknown) => typeLabels[value as string] || String(value),
    status: (value: unknown) => statusLabels[value as string] || String(value),
    issued_at: formatIssuedAt,
  };

  // Generate filename with timestamp
  const filename = `certificates_${new Date().toISOString().split("T")[0]}`;

  return (
    <AdminExportButton
      data={certificates}
      filename={filename}
      formatters={formatters}
      labels={labels}
    />
  );
}
