import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type CertificateTierLookupRecord = {
  donation_id: string | null;
  type: string;
};

export type CertificateDonationDetails = {
  amount: number;
  currency: string;
  tierCode: string | null;
};

function getMetadataTierCode(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const tier = (metadata as Record<string, unknown>).tier;

  return tier === "monthly" || tier === "quarterly" || tier === "yearly" ? tier : null;
}

export function inferDonationTierCodeFromAmount(amount: number, currency: string) {
  if (currency.toLowerCase() !== "usd") {
    return null;
  }

  if (amount >= 8640) {
    return "yearly";
  }

  if (amount >= 2430) {
    return "quarterly";
  }

  return "monthly";
}

export async function getDonationDetailsForCertificate(
  supabase: SupabaseClient<Database>,
  certificate: CertificateTierLookupRecord,
  userId: string,
): Promise<CertificateDonationDetails | null> {
  if (certificate.type !== "donation" || !certificate.donation_id) {
    return null;
  }

  const { data: donation, error: donationError } = await supabase
    .from("donations")
    .select("amount,currency,tier_id,metadata")
    .eq("id", certificate.donation_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (donationError) {
    throw donationError;
  }

  if (!donation) {
    return null;
  }

  if (!donation.tier_id) {
    return {
      amount: donation.amount,
      currency: donation.currency,
      tierCode: getMetadataTierCode(donation.metadata) ?? inferDonationTierCodeFromAmount(donation.amount, donation.currency),
    };
  }

  const { data: tier, error: tierError } = await supabase
    .from("donation_tiers")
    .select("code")
    .eq("id", donation.tier_id)
    .maybeSingle();

  if (tierError) {
    throw tierError;
  }

  return {
    amount: donation.amount,
    currency: donation.currency,
    tierCode: tier?.code ?? getMetadataTierCode(donation.metadata) ?? inferDonationTierCodeFromAmount(donation.amount, donation.currency),
  };
}
