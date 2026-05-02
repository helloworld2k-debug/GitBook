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

export function inferDonationTierCodeFromAmount(amount: number, currency: string) {
  if (currency.toLowerCase() !== "usd") {
    return null;
  }

  if (amount >= 5000) {
    return "yearly";
  }

  if (amount >= 1500) {
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
    .select("amount,currency,tier_id")
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
      tierCode: inferDonationTierCodeFromAmount(donation.amount, donation.currency),
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
    tierCode: tier?.code ?? inferDonationTierCodeFromAmount(donation.amount, donation.currency),
  };
}
