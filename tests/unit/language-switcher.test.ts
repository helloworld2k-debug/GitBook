import { describe, expect, it } from "vitest";
import { getLanguageLabels, getLocalizedPath } from "@/components/language-switcher";

describe("language switcher URL generation", () => {
  it("replaces a known locale prefix and preserves the rest of the path", () => {
    expect(getLocalizedPath("/en/donate?tier=yearly", "ja")).toBe("/ja/donate?tier=yearly");
    expect(getLocalizedPath("/zh-Hant/dashboard/certificates/abc", "ko")).toBe("/ko/dashboard/certificates/abc");
  });

  it("falls back to the target locale homepage when there is no known locale prefix", () => {
    expect(getLocalizedPath("/admin/releases", "zh-Hant")).toBe("/zh-Hant");
    expect(getLocalizedPath("/", "en")).toBe("/en");
  });

  it("defines flag metadata for every supported language", () => {
    expect(getLanguageLabels()).toEqual({
      en: expect.objectContaining({ countryCode: "US", short: "EN" }),
      "zh-Hant": expect.objectContaining({ countryCode: "TW", short: "繁" }),
      ja: expect.objectContaining({ countryCode: "JP", short: "日" }),
      ko: expect.objectContaining({ countryCode: "KR", short: "한" }),
    });
  });
});
