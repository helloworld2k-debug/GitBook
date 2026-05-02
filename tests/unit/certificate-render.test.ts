import { describe, expect, it } from "vitest";
import { formatCertificateIssuedDate, getCertificateTypeLabel } from "@/lib/certificates/render";
import { getCertificateTemplate, getCertificateTemplateForRecord } from "@/lib/certificates/templates";

describe("certificate rendering helpers", () => {
  it("selects the localized certificate type label", () => {
    expect(getCertificateTypeLabel("honor", { donation: "Donation", honor: "Honor" })).toBe("Honor");
    expect(getCertificateTypeLabel("donation", { donation: "寄付証明書", honor: "表彰証明書" })).toBe("寄付証明書");
  });

  it("formats issued dates in UTC with the current locale", () => {
    expect(formatCertificateIssuedDate("2026-04-30T00:00:00.000Z", "en", "Pending")).toBe("April 30, 2026");
    expect(formatCertificateIssuedDate("2026-04-30T00:00:00.000Z", "ja", "未発行")).toBe("2026年4月30日");
    expect(formatCertificateIssuedDate(null, "ja", "未発行")).toBe("未発行");
  });

  it("selects donation certificate templates from tier codes", () => {
    expect(getCertificateTemplate("donation", "monthly")).toMatchObject({
      code: "monthly",
      backgroundUrl: "/certificates/monthly-bg.webp",
    });
    expect(getCertificateTemplate("donation", "quarterly")).toMatchObject({
      code: "quarterly",
      backgroundUrl: "/certificates/quarterly-bg.webp",
    });
    expect(getCertificateTemplate("donation", "yearly")).toMatchObject({
      code: "yearly",
      backgroundUrl: "/certificates/yearly-bg.webp",
    });
  });

  it("keeps honor certificates on the honor template and falls back old donation records to monthly", () => {
    expect(getCertificateTemplate("honor", "yearly")).toMatchObject({ code: "honor", backgroundUrl: null });
    expect(getCertificateTemplate("donation", null)).toMatchObject({
      code: "monthly",
      backgroundUrl: "/certificates/monthly-bg.webp",
    });
  });

  it("reads nested donation tier data from certificate records", () => {
    expect(
      getCertificateTemplateForRecord({
        type: "donation",
        donation: {
          tier: {
            code: "quarterly",
          },
        },
      }),
    ).toMatchObject({ code: "quarterly" });
    expect(getCertificateTemplateForRecord({ type: "honor", donation: null })).toMatchObject({ code: "honor" });
  });
});
