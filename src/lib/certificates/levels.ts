import { sponsorLevels } from "@/config/site";

export function getSponsorLevelForTotal(totalAmount: number) {
  return [...sponsorLevels]
    .sort((a, b) => b.minimumAmount - a.minimumAmount)
    .find((level) => totalAmount >= level.minimumAmount) ?? null;
}
