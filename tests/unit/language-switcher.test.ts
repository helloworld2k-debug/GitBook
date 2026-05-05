import { describe, expect, it } from "vitest";
import { getLanguageLabels, getLocalizedPath } from "@/components/language-switcher";

describe("language switcher URL generation", () => {
  it("replaces a known locale prefix and preserves the rest of the path", () => {
    expect(getLocalizedPath("/en/contributions?tier=yearly", "ja")).toBe("/ja/contributions?tier=yearly");
    expect(getLocalizedPath("/zh-Hant/dashboard/certificates/abc", "ko")).toBe("/ko/dashboard/certificates/abc");
  });

  it("falls back to the target locale homepage when there is no known locale prefix", () => {
    expect(getLocalizedPath("/admin/releases", "zh-Hant")).toBe("/zh-Hant");
    expect(getLocalizedPath("/", "en")).toBe("/en");
  });

  it("defines language abbreviations for every supported language", () => {
    expect(getLanguageLabels()).toEqual({
      en: expect.objectContaining({ short: "EN", label: "English" }),
      "zh-Hant": expect.objectContaining({ short: "ZH", label: "中文" }),
      ja: expect.objectContaining({ short: "JP", label: "日本語" }),
      ko: expect.objectContaining({ short: "KR", label: "한국어" }),
    });
  });
});
