import { describe, expect, it } from "vitest";
import { formatCertificateIssuedDate, getCertificateTypeLabel } from "@/lib/certificates/render";

describe("certificate rendering helpers", () => {
  it("selects the localized certificate type label", () => {
    expect(getCertificateTypeLabel("honor", { donation: "Donation", honor: "Honor" })).toBe("Honor");
    expect(getCertificateTypeLabel("donation", { donation: "寄付証明書", honor: "表彰証明書" })).toBe("寄付証明書");
  });

  it("formats issued dates with the current locale", () => {
    expect(formatCertificateIssuedDate("2026-04-30T00:00:00.000Z", "ja", "未発行")).toBe("2026年4月30日");
    expect(formatCertificateIssuedDate(null, "ja", "未発行")).toBe("未発行");
  });
});
