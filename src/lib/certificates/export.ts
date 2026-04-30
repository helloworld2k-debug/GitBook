import { formatCertificateIssuedDate } from "@/lib/certificates/render";

export type CertificateExportCopy = {
  brand: string;
  certificateNumber: string;
  description: string;
  issued: string;
  pendingIssueDate: string;
  presentedTo: string;
  title: string;
};

export type CertificateExportData = {
  certificateNumber: string;
  copy: CertificateExportCopy;
  issuedAt: string | Date | null;
  label: string;
  locale: string;
  recipientName: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(value: string) {
  return escapeXml(value);
}

export function getCertificateExportFilename(certificateNumber: string, format: "svg") {
  const safeNumber = certificateNumber.replace(/[^a-zA-Z0-9._-]+/g, "-");

  return `three-friends-certificate-${safeNumber}.${format}`;
}

export function renderCertificateSvg({
  certificateNumber,
  copy,
  issuedAt,
  label,
  locale,
  recipientName,
}: CertificateExportData) {
  const issuedDate = formatCertificateIssuedDate(issuedAt, locale, copy.pendingIssueDate);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990" role="img" aria-labelledby="certificate-title certificate-description">
  <title id="certificate-title">${text(copy.title)}</title>
  <desc id="certificate-description">${text(copy.description)}</desc>
  <rect width="1400" height="990" fill="#f8fafc"/>
  <rect x="90" y="90" width="1220" height="810" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
  <rect x="130" y="130" width="1140" height="730" fill="none" stroke="#e2e8f0" stroke-width="2"/>
  <text x="700" y="218" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="8" fill="#64748b">${text(copy.brand)}</text>
  <text x="700" y="326" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700" fill="#020617">${text(copy.title)}</text>
  <foreignObject x="260" y="370" width="880" height="108">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; font-size: 30px; line-height: 1.45; color: #475569; text-align: center;">${text(copy.description)}</div>
  </foreignObject>
  <line x1="440" y1="520" x2="960" y2="520" stroke="#e2e8f0" stroke-width="2"/>
  <text x="700" y="590" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="6" fill="#64748b">${text(copy.presentedTo.toUpperCase())}</text>
  <text x="700" y="668" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="58" font-weight="700" fill="#020617">${text(recipientName)}</text>
  <text x="700" y="730" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="600" fill="#334155">${text(label)}</text>
  <rect x="220" y="785" width="420" height="76" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <text x="250" y="818" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#020617">${text(copy.certificateNumber)}</text>
  <text x="250" y="847" font-family="Inter, Arial, sans-serif" font-size="21" fill="#475569">${text(certificateNumber)}</text>
  <rect x="760" y="785" width="420" height="76" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <text x="790" y="818" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#020617">${text(copy.issued)}</text>
  <text x="790" y="847" font-family="Inter, Arial, sans-serif" font-size="21" fill="#475569">${text(issuedDate)}</text>
</svg>
`;
}
