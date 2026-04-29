import { getSponsorLevelForTotal } from "@/lib/certificates/levels";
import { formatCertificateNumber, type CertificateType } from "@/lib/certificates/numbers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UNIQUE_CONFLICT_CODE = "23505";

export function buildCertificateNumber(type: CertificateType, sequence: number, issuedAt = new Date()) {
  return formatCertificateNumber(type, issuedAt.getUTCFullYear(), sequence);
}

function isUniqueConflict(error: { code?: string } | null) {
  return error?.code === UNIQUE_CONFLICT_CODE;
}

export async function generateCertificatesForDonation(donationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: donation, error: donationError } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .eq("status", "paid")
    .single();

  if (donationError || !donation) {
    throw new Error(`Paid donation not found: ${donationId}`);
  }

  const { data: existingDonationCertificate, error: existingDonationCertificateError } = await supabase
    .from("certificates")
    .select("id")
    .eq("donation_id", donationId)
    .eq("type", "donation")
    .maybeSingle();

  if (existingDonationCertificateError) {
    throw new Error("Unable to check donation certificate");
  }

  let donationCertificateCreated = false;

  if (!existingDonationCertificate) {
    const { data: donationNumber, error: numberError } = await supabase.rpc("allocate_certificate_number", {
      input_type: "donation",
    });

    if (numberError || !donationNumber) {
      throw new Error("Unable to allocate donation certificate number");
    }

    const { error: insertDonationCertificateError } = await supabase.from("certificates").insert({
      certificate_number: donationNumber,
      user_id: donation.user_id,
      donation_id: donation.id,
      type: "donation",
      status: "active",
    });

    if (insertDonationCertificateError) {
      if (!isUniqueConflict(insertDonationCertificateError)) {
        throw new Error("Unable to create donation certificate");
      }
    } else {
      donationCertificateCreated = true;
    }
  }

  const { data: totalAmount, error: totalError } = await supabase.rpc("get_paid_total", {
    input_user_id: donation.user_id,
  });

  if (totalError) {
    throw new Error("Unable to calculate paid donation total");
  }

  const level = getSponsorLevelForTotal(totalAmount ?? 0);
  if (!level) {
    return { donationId, donationCertificateCreated, honorCertificateCreated: false };
  }

  const { data: sponsorLevel, error: sponsorLevelError } = await supabase
    .from("sponsor_levels")
    .select("id")
    .eq("code", level.code)
    .single();

  if (sponsorLevelError || !sponsorLevel) {
    throw new Error(`Sponsor level not found: ${level.code}`);
  }

  const { data: existingHonorCertificate, error: existingHonorCertificateError } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", donation.user_id)
    .eq("sponsor_level_id", sponsorLevel.id)
    .eq("type", "honor")
    .maybeSingle();

  if (existingHonorCertificateError) {
    throw new Error("Unable to check honor certificate");
  }

  if (existingHonorCertificate) {
    return { donationId, donationCertificateCreated, honorCertificateCreated: false };
  }

  const { data: honorNumber, error: honorNumberError } = await supabase.rpc("allocate_certificate_number", {
    input_type: "honor",
  });

  if (honorNumberError || !honorNumber) {
    throw new Error("Unable to allocate honor certificate number");
  }

  const { error: insertHonorCertificateError } = await supabase.from("certificates").insert({
    certificate_number: honorNumber,
    user_id: donation.user_id,
    sponsor_level_id: sponsorLevel.id,
    type: "honor",
    status: "active",
  });

  if (insertHonorCertificateError) {
    if (isUniqueConflict(insertHonorCertificateError)) {
      return { donationId, donationCertificateCreated, honorCertificateCreated: false };
    }

    throw new Error("Unable to create honor certificate");
  }

  return { donationId, donationCertificateCreated, honorCertificateCreated: true };
}
