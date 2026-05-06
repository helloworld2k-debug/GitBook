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
    expect(siteConfig.description).toContain("voluntary contributions");
  });

  it("keeps public download links defined", () => {
    expect(siteConfig.githubReleasesUrl).toMatch(/^https:\/\//);
    expect(siteConfig.downloadLinks.macos).toMatch(/^https:\/\//);
    expect(siteConfig.downloadLinks.windows).toMatch(/^https:\/\//);
    expect(siteConfig.downloadLinks.linux).toMatch(/^https:\/\//);
  });

  it("defines one-time USD donation tiers", () => {
    expect(donationTiers).toEqual([
      { code: "monthly", labelKey: "donate.tiers.monthly", amount: 900, currency: "usd", compareAtAmount: null },
      { code: "quarterly", labelKey: "donate.tiers.quarterly", amount: 2430, currency: "usd", compareAtAmount: 2700 },
      { code: "yearly", labelKey: "donate.tiers.yearly", amount: 8640, currency: "usd", compareAtAmount: 10800 },
    ]);
  });

  it("defines cumulative sponsor thresholds in ascending order", () => {
    expect(sponsorLevels.map((level) => level.code)).toEqual(["bronze", "silver", "gold", "platinum"]);
    expect(sponsorLevels.map((level) => level.minimumAmount)).toEqual([500, 5000, 15000, 50000]);
  });
});
