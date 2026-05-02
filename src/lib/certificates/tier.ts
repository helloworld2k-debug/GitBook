import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type CertificateTierLookupRecord = {
  donation_id: string | null;
  type: string;
};

export async function getDonationTierCodeForCertificate(
  supabase: SupabaseClient<Database>,
  certificate: CertificateTierLookupRecord,
  userId: string,
) {
  if (certificate.type !== "donation" || !certificate.donation_id) {
    return null;
  }

  const { data: donation, error: donationError } = await supabase
    .from("donations")
    .select("tier_id")
    .eq("id", certificate.donation_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (donationError) {
    throw donationError;
  }

  if (!donation?.tier_id) {
    return null;
  }

  const { data: tier, error: tierError } = await supabase
    .from("donation_tiers")
    .select("code")
    .eq("id", donation.tier_id)
    .maybeSingle();

  if (tierError) {
    throw tierError;
  }

  return tier?.code ?? null;
}
