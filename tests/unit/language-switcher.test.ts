import { describe, expect, it } from "vitest";
import { getLanguageLabels, getLocalizedPath } from "@/components/language-switcher";

describe("language switcher URL generation", () => {
  it("replaces a known locale prefix and preserves the rest of the path", () => {
    expect(getLocalizedPath("/en/contributions?tier=yearly", "zh")).toBe("/zh/contributions?tier=yearly");
    expect(getLocalizedPath("/zh/dashboard/certificates/abc", "en")).toBe("/en/dashboard/certificates/abc");
  });

  it("falls back to the target locale homepage when there is no known locale prefix", () => {
    expect(getLocalizedPath("/admin/releases", "zh")).toBe("/zh");
    expect(getLocalizedPath("/", "en")).toBe("/en");
  });

  it("defines language abbreviations for every supported language", () => {
    expect(getLanguageLabels()).toEqual({
      en: expect.objectContaining({ short: "EN", label: "English" }),
      zh: expect.objectContaining({ short: "ZH", label: "中文" }),
    });
  });
});
