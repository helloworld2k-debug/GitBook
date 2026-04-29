export type CertificateType = "donation" | "honor";

const typeCode: Record<CertificateType, string> = {
  donation: "D",
  honor: "H",
};

export function formatCertificateNumber(type: CertificateType, year: number, sequence: number) {
  return `TFD-${year}-${typeCode[type]}-${String(sequence).padStart(6, "0")}`;
}
