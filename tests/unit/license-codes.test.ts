import { describe, expect, it } from "vitest";
import {
  decryptLicenseCode,
  encryptLicenseCode,
  formatLicenseCode,
  generateLicenseCodeForDuration,
  generateLicenseCode,
  getLicenseDurationDays,
  getLicenseDurationPrefix,
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

  it("generates duration-prefixed license codes that identify the offer in the first two characters", () => {
    expect(generateLicenseCodeForDuration("trial_3_day", 1)).toMatch(/^T1[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(generateLicenseCodeForDuration("trial_3_day", 7)).toMatch(/^T7[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(generateLicenseCodeForDuration("month_1", 30)).toMatch(/^1M[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(generateLicenseCodeForDuration("month_3", 90)).toMatch(/^3M[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(generateLicenseCodeForDuration("year_1", 365)).toMatch(/^1Y[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("maps duration kinds and trial days to operator-visible prefixes", () => {
    expect(getLicenseDurationPrefix("trial_3_day", 5)).toBe("T5");
    expect(getLicenseDurationPrefix("month_1", 30)).toBe("1M");
    expect(getLicenseDurationPrefix("month_3", 90)).toBe("3M");
    expect(getLicenseDurationPrefix("year_1", 365)).toBe("1Y");
    expect(() => getLicenseDurationPrefix("trial_3_day", 8)).toThrow("Trial license codes must use 1 to 7 trial days");
  });

  it("masks license codes without exposing the full secret", () => {
    expect(maskLicenseCode("ABCD-EFGH-IJKL-MNOP")).toBe("ABCD-****-****-MNOP");
    expect(maskLicenseCode("T3CD-EFGH-IJKL-MNOP")).toBe("T3CD-****-****-MNOP");
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
