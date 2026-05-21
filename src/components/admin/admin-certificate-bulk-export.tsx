"use client";

import { downloadAsCsv } from "@/lib/admin/export";

type Certificate = {
  id: string;
  certificate_number: string;
  type: string;
  status: string;
  issued_at: string | null;
};

type AdminCertificateBulkExportProps = {
  certificates: Certificate[];
  locale: string;
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
};

export function AdminCertificateBulkExport({
  certificates,
  locale,
  typeLabels,
  statusLabels,
}: AdminCertificateBulkExportProps) {
  const handleExportSelected = () => {
    // Get selected certificate IDs
    const selectedInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name="certificate_ids"]:checked',
    );
    const selectedIds = new Set(
      Array.from(selectedInputs).map((input) => input.value),
    );

    // Filter selected certificates
    const selectedCertificates = certificates.filter((cert) =>
      selectedIds.has(cert.id),
    );

    if (selectedCertificates.length === 0) {
      return;
    }

    // Format data for CSV export
    const formattedData = selectedCertificates.map((item) => ({
      id: item.id,
      certificate_number: item.certificate_number,
      type: typeLabels[item.type] || item.type,
      status: statusLabels[item.status] || item.status,
      issued_at: item.issued_at
        ? new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(new Date(item.issued_at))
        : "",
    }));

    downloadAsCsv(
      formattedData,
      `certificates_selected_${new Date().toISOString().split("T")[0]}`,
    );
  };

  return (
    <button
      onClick={handleExportSelected}
      type="button"
      className="hidden"
      data-bulk-export-trigger
    />
  );
}
