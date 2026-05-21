/**
 * Converts data to CSV format and triggers download
 */
export function downloadAsCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.join(","));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      // Handle null/undefined
      if (value == null) {
        return "";
      }
      // Handle objects/arrays (stringify)
      if (typeof value === "object") {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      // Handle strings with quotes/commas
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  }

  // Add BOM for Excel UTF-8 compatibility
  const BOM = "﻿";
  const csvContent = BOM + csvRows.join("\n");

  // Create download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats data for CSV export by converting nested objects to strings
 */
export function flattenDataForExport<T extends Record<string, unknown>>(
  data: T[],
  formatters?: Partial<Record<keyof T, (value: unknown) => string>>,
): Record<string, string>[] {
  return data.map((item) => {
    const flattened: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      const formatter = formatters?.[key as keyof T];
      if (formatter) {
        flattened[key] = formatter(value);
      } else if (value == null) {
        flattened[key] = "";
      } else if (typeof value === "object") {
        flattened[key] = JSON.stringify(value);
      } else {
        flattened[key] = String(value);
      }
    }
    return flattened;
  });
}
