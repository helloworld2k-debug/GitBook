import { formatCertificateIssuedDate } from "@/lib/certificates/render";
import { getCertificateTemplate, type CertificateTemplate } from "@/lib/certificates/templates";

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
  template?: CertificateTemplate;
  templateBackgroundDataUri?: string | null;
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
  template = getCertificateTemplate("donation", "monthly"),
  templateBackgroundDataUri,
}: CertificateExportData) {
  const issuedDate = formatCertificateIssuedDate(issuedAt, locale, copy.pendingIssueDate);
  const backgroundImage = templateBackgroundDataUri
    ? `<image href="${escapeXml(templateBackgroundDataUri)}" x="0" y="0" width="1600" height="1100" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="1600" height="1100" fill="#020617"/>`;
  const titleFill = escapeXml(template.text);
  const mutedFill = escapeXml(template.textMuted);
  const accent = escapeXml(template.accent);
  const foil = escapeXml(template.foil);
  const panelFill = escapeXml(template.panelFill);
  const panelStroke = escapeXml(template.panelStroke);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100" role="img" aria-labelledby="certificate-title certificate-description" data-certificate-template="${text(template.code)}">
  <title id="certificate-title">${text(copy.title)}</title>
  <desc id="certificate-description">${text(copy.description)}</desc>
  ${backgroundImage}
  <rect width="1600" height="1100" fill="rgba(2,6,23,0.34)"/>
  <rect x="64" y="64" width="1472" height="972" rx="28" fill="rgba(2,6,23,0.22)" stroke="${panelStroke}" stroke-width="3"/>
  <rect x="105" y="105" width="1390" height="890" rx="18" fill="none" stroke="${foil}" stroke-opacity="0.34" stroke-width="2"/>
  <path d="M180 174H1420" stroke="${accent}" stroke-opacity="0.34" stroke-width="2"/>
  <path d="M220 918H1380" stroke="${foil}" stroke-opacity="0.38" stroke-width="2"/>
  <text x="800" y="250" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="8" fill="${foil}">${text(copy.brand)}</text>
  <text x="800" y="365" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="78" font-weight="700" fill="${titleFill}">${text(copy.title)}</text>
  <foreignObject x="310" y="410" width="980" height="112">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; font-size: 30px; line-height: 1.45; color: ${mutedFill}; text-align: center;">${text(copy.description)}</div>
  </foreignObject>
  <line x1="500" y1="560" x2="1100" y2="560" stroke="${accent}" stroke-opacity="0.34" stroke-width="2"/>
  <circle cx="800" cy="560" r="5" fill="${foil}"/>
  <text x="800" y="635" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="6" fill="${foil}">${text(copy.presentedTo.toUpperCase())}</text>
  <text x="800" y="716" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700" fill="${titleFill}">${text(recipientName)}</text>
  <text x="800" y="780" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="600" fill="${mutedFill}">${text(label)}</text>
  <rect x="250" y="860" width="470" height="88" rx="12" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="285" y="898" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="${titleFill}">${text(copy.certificateNumber)}</text>
  <text x="285" y="930" font-family="Inter, Arial, sans-serif" font-size="21" fill="${mutedFill}">${text(certificateNumber)}</text>
  <rect x="880" y="860" width="470" height="88" rx="12" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="915" y="898" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="${titleFill}">${text(copy.issued)}</text>
  <text x="915" y="930" font-family="Inter, Arial, sans-serif" font-size="21" fill="${mutedFill}">${text(issuedDate)}</text>
</svg>
`;
}
