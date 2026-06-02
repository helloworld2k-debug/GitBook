import { describe, expect, it } from "vitest";
import { ADMIN_TIME_ZONE, formatAdminDateTime, formatDateTimeWithSeconds } from "@/lib/format/datetime";

describe("formatDateTimeWithSeconds", () => {
  it("defaults admin timestamps to China Beijing time", () => {
    const formatted = formatDateTimeWithSeconds("2026-05-01T12:34:56.000Z", "en");

    expect(ADMIN_TIME_ZONE).toBe("Asia/Shanghai");
    expect(formatted).toContain("20:34:56");
    expect(formatted).toMatch(/GMT\+8|China Standard Time/);
  });

  it("keeps explicit timezone overrides for non-admin callers", () => {
    const formatted = formatDateTimeWithSeconds("2026-05-01T12:34:56.000Z", "en", "UTC");

    expect(formatted).toContain("12:34:56");
    expect(formatted).toContain("UTC");
  });
});

describe("formatAdminDateTime", () => {
  it("uses Beijing time for admin pages", () => {
    const formatted = formatAdminDateTime("2026-05-01T00:30:00.000Z", "en");

    expect(formatted).toContain("08:30");
    expect(formatted).toMatch(/GMT\+8|China Standard Time/);
  });
});
