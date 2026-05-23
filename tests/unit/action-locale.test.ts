import { describe, expect, it } from "vitest";
import { getActionLocale } from "@/lib/i18n/action-locale";

describe("getActionLocale", () => {
  it("keeps supported locales for server actions", () => {
    expect(getActionLocale("en")).toBe("en");
    expect(getActionLocale("zh")).toBe("zh");
  });

  it("falls back to English for unsupported or missing locales", () => {
    expect(getActionLocale("zh-Hant")).toBe("en");
    expect(getActionLocale("ja")).toBe("en");
    expect(getActionLocale("ko")).toBe("en");
    expect(getActionLocale("fr")).toBe("en");
    expect(getActionLocale(null)).toBe("en");
    expect(getActionLocale(undefined)).toBe("en");
  });
});
