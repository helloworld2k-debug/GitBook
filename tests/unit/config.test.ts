import { describe, expect, it } from "vitest";
import { donationTiers, siteConfig, sponsorLevels, supportedLocales } from "@/config/site";

describe("site config", () => {
  it("uses English as the default supported locale", () => {
    expect(supportedLocales[0]).toBe("en");
    expect(supportedLocales).toEqual(["en", "zh-Hant", "ja", "ko"]);
  });

  it("brands the public download site as GitBook AI", () => {
    expect(siteConfig.name).toBe("GitBook AI");
    expect(siteConfig.description).toContain("AI coding book");
  });

  it("defines one-time USD donation tiers", () => {
    expect(donationTiers).toEqual([
      { code: "monthly", labelKey: "donate.tiers.monthly", amount: 500, currency: "usd" },
      { code: "quarterly", labelKey: "donate.tiers.quarterly", amount: 1500, currency: "usd" },
      { code: "yearly", labelKey: "donate.tiers.yearly", amount: 5000, currency: "usd" },
    ]);
  });

  it("defines cumulative sponsor thresholds in ascending order", () => {
    expect(sponsorLevels.map((level) => level.code)).toEqual(["bronze", "silver", "gold", "platinum"]);
    expect(sponsorLevels.map((level) => level.minimumAmount)).toEqual([500, 5000, 15000, 50000]);
  });
});
