import { describe, expect, it } from "vitest";
import { formatCertificateNumber } from "@/lib/certificates/numbers";

describe("formatCertificateNumber", () => {
  it("formats donation certificate numbers", () => {
    expect(formatCertificateNumber("donation", 2026, 1)).toBe("TFD-2026-D-000001");
  });

  it("formats honor certificate numbers", () => {
    expect(formatCertificateNumber("honor", 2026, 42)).toBe("TFD-2026-H-000042");
  });
});
