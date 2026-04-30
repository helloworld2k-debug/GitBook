import type { Database } from "@/lib/database.types";

type PublicSponsorRow = Database["public"]["Functions"]["get_public_sponsors"]["Returns"][number];

type PublicSponsorClient = {
  rpc: (fn: "get_public_sponsors") => PromiseLike<{
    data: PublicSponsorRow[] | null;
    error: Error | null;
  }>;
};

export type PublicSponsor = {
  id: string;
  displayName: string;
  paidDonationCount: number;
  paidTotalAmount: number;
  currency: string;
  sponsorLevelCode: string | null;
};

export async function getPublicSponsors(client: PublicSponsorClient, fallbackDisplayName: string) {
  const { data, error } = await client.rpc("get_public_sponsors");

  if (error) {
    throw error;
  }

  return (data ?? []).map((sponsor) => ({
    id: sponsor.public_sponsor_id,
    displayName: sponsor.display_name?.trim() || fallbackDisplayName,
    paidDonationCount: sponsor.paid_donation_count,
    paidTotalAmount: sponsor.paid_total_amount,
    currency: sponsor.currency,
    sponsorLevelCode: sponsor.sponsor_level_code,
  }));
}
