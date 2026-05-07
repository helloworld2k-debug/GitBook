import { describe, expect, it } from "vitest";
import { getActionLocale } from "@/lib/i18n/action-locale";

describe("getActionLocale", () => {
  it("keeps supported locales for server actions", () => {
    expect(getActionLocale("en")).toBe("en");
    expect(getActionLocale("zh-Hant")).toBe("zh-Hant");
    expect(getActionLocale("ja")).toBe("ja");
  });

  it("falls back to English for unsupported or missing locales", () => {
    expect(getActionLocale("fr")).toBe("en");
    expect(getActionLocale(null)).toBe("en");
    expect(getActionLocale(undefined)).toBe("en");
  });
});
