import { describe, expect, it } from "vitest";
import {
  decryptLicenseCode,
  encryptLicenseCode,
  formatLicenseCode,
  generateLicenseCode,
  getLicenseDurationDays,
  maskLicenseCode,
} from "@/lib/license/license-codes";

describe("license code helpers", () => {
  it("formats license codes as XXXX-XXXX-XXXX-XXXX", () => {
    expect(formatLicenseCode("abcd efgh ijkl mnop")).toBe("ABCD-EFGH-IJKL-MNOP");
    expect(formatLicenseCode("abcd-efgh-ijkl-mnop")).toBe("ABCD-EFGH-IJKL-MNOP");
  });

  it("generates non-ambiguous 16 character license codes with separators", () => {
    const code = generateLicenseCode();

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  });

  it("masks license codes without exposing the full secret", () => {
    expect(maskLicenseCode("ABCD-EFGH-IJKL-MNOP")).toBe("ABCD-****-****-MNOP");
  });

  it("maps supported duration kinds to days", () => {
    expect(getLicenseDurationDays("trial_3_day")).toBe(3);
    expect(getLicenseDurationDays("month_1")).toBe(30);
    expect(getLicenseDurationDays("month_3")).toBe(90);
    expect(getLicenseDurationDays("year_1")).toBe(365);
  });

  it("encrypts license codes without storing plaintext and can decrypt with the same key", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptLicenseCode("ABCD-EFGH-IJKL-MNOP", key);

    expect(encrypted.ciphertext).not.toContain("ABCD");
    expect(encrypted.ciphertext).not.toContain("MNOP");
    expect(decryptLicenseCode(encrypted, key)).toBe("ABCD-EFGH-IJKL-MNOP");
  });
});
