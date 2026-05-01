import { describe, expect, it } from "vitest";
import { formatDateTimeWithSeconds } from "@/lib/format/datetime";

describe("formatDateTimeWithSeconds", () => {
  it("includes seconds for donation reconciliation", () => {
    const formatted = formatDateTimeWithSeconds("2026-05-01T12:34:56.000Z", "en", "UTC");

    expect(formatted).toContain("12:34:56");
    expect(formatted).toContain("UTC");
  });
});
