export const supportedLocales = ["en", "zh-Hant", "ja", "ko"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

export const siteConfig = {
  name: "GitBook AI",
  description: "AI coding book software downloads supported by voluntary donations.",
  githubReleasesUrl: "https://github.com/threefriends/app/releases/latest",
  downloadLinks: {
    macos: "https://github.com/threefriends/app/releases/latest",
    windows: "https://github.com/threefriends/app/releases/latest",
    linux: "https://github.com/threefriends/app/releases/latest",
  },
};

export const donationTiers = [
  { code: "monthly", labelKey: "donate.tiers.monthly", amount: 500, currency: "usd" },
  { code: "quarterly", labelKey: "donate.tiers.quarterly", amount: 1500, currency: "usd" },
  { code: "yearly", labelKey: "donate.tiers.yearly", amount: 5000, currency: "usd" },
] as const;

export const sponsorLevels = [
  { code: "bronze", labelKey: "sponsors.levels.bronze", minimumAmount: 500, currency: "usd" },
  { code: "silver", labelKey: "sponsors.levels.silver", minimumAmount: 5000, currency: "usd" },
  { code: "gold", labelKey: "sponsors.levels.gold", minimumAmount: 15000, currency: "usd" },
  { code: "platinum", labelKey: "sponsors.levels.platinum", minimumAmount: 50000, currency: "usd" },
] as const;
