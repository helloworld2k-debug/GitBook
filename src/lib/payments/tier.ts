import { donationTiers } from "@/config/site";

export function findDonationTier(code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  return donationTiers.find((tier) => tier.code === code) ?? null;
}
