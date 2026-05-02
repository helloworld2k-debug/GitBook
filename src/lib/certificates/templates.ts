export type CertificateKind = "donation" | "honor";

export type DonationCertificateTier = "monthly" | "quarterly" | "yearly";

export type CertificateTemplateCode = DonationCertificateTier | "honor";

export type CertificateTemplate = {
  accent: string;
  backgroundUrl: `/certificates/${string}.webp` | null;
  code: CertificateTemplateCode;
  foil: string;
  panelFill: string;
  panelStroke: string;
  text: string;
  textMuted: string;
};

export type CertificateRecordWithTier = {
  donation?:
    | {
        tier?:
          | {
              code?: string | null;
            }
          | Array<{
              code?: string | null;
            }>
          | null;
      }
    | Array<{
        tier?:
          | {
              code?: string | null;
            }
          | Array<{
              code?: string | null;
            }>
          | null;
      }>
    | null;
  type: CertificateKind | string;
};

const donationTemplates = {
  monthly: {
    accent: "#22d3ee",
    backgroundUrl: "/certificates/monthly-bg.webp",
    code: "monthly",
    foil: "#a5f3fc",
    panelFill: "rgba(8, 20, 34, 0.74)",
    panelStroke: "rgba(103, 232, 249, 0.34)",
    text: "#f8fafc",
    textMuted: "#cbd5e1",
  },
  quarterly: {
    accent: "#7dd3fc",
    backgroundUrl: "/certificates/quarterly-bg.webp",
    code: "quarterly",
    foil: "#c4b5fd",
    panelFill: "rgba(13, 18, 42, 0.76)",
    panelStroke: "rgba(196, 181, 253, 0.4)",
    text: "#ffffff",
    textMuted: "#dbeafe",
  },
  yearly: {
    accent: "#67e8f9",
    backgroundUrl: "/certificates/yearly-bg.webp",
    code: "yearly",
    foil: "#fde68a",
    panelFill: "rgba(18, 19, 31, 0.78)",
    panelStroke: "rgba(253, 230, 138, 0.48)",
    text: "#ffffff",
    textMuted: "#f1f5f9",
  },
} as const satisfies Record<DonationCertificateTier, CertificateTemplate>;

const honorTemplate = {
  accent: "#22d3ee",
  backgroundUrl: null,
  code: "honor",
  foil: "#fde68a",
  panelFill: "rgba(15, 23, 42, 0.72)",
  panelStroke: "rgba(125, 211, 252, 0.32)",
  text: "#ffffff",
  textMuted: "#cbd5e1",
} as const satisfies CertificateTemplate;

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeDonationTierCode(tierCode: string | null | undefined): DonationCertificateTier {
  if (tierCode === "quarterly" || tierCode === "yearly") {
    return tierCode;
  }

  return "monthly";
}

export function getCertificateTemplate(type: CertificateKind | string, donationTierCode: string | null | undefined) {
  if (type === "honor") {
    return honorTemplate;
  }

  return donationTemplates[normalizeDonationTierCode(donationTierCode)];
}

export function getCertificateTemplateForRecord(record: CertificateRecordWithTier) {
  const donation = first(record.donation);
  const tier = first(donation?.tier);

  return getCertificateTemplate(record.type, tier?.code);
}
