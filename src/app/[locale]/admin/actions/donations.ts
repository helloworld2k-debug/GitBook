"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getManualReference, getRequiredReason, getRequiredString, getSafeLocale } from "./validation";

export async function addManualDonation(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const providerTransactionId = getManualReference(formData);
  const userIdentifier = getRequiredString(formData, "user_identifier", "User is required");
  const amount = Number(formData.get("amount"));

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number of cents");
  }

  const supabase = createSupabaseAdminClient();
  const lookupColumn = userIdentifier.includes("@") ? "email" : "id";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .eq(lookupColumn, userIdentifier)
    .single();

  if (profileError || !profile) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/donations",
      formData,
      key: "manual-donation-failed",
      locale,
      tone: "error",
    });
  }

  const { data: donationId, error: donationError } = await supabase.rpc("create_manual_paid_donation_with_audit", {
    input_admin_user_id: admin.id,
    input_amount: amount,
    input_currency: "usd",
    input_provider_transaction_id: providerTransactionId,
    input_reason: reason,
    input_user_id: profile.id,
  });

  if (donationError || !donationId) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/donations",
      formData,
      key: "manual-donation-failed",
      locale,
      tone: "error",
    });
  }

  await generateCertificatesForDonation(donationId);
  await extendCloudSyncEntitlementForDonation(supabase, {
    userId: profile.id,
    donationId,
    tierCode: "yearly",
    paidAt: new Date(),
  });

  revalidatePath(`/${locale}/admin/donations`);
  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/users/${profile.id}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/donations",
    formData,
    key: "manual-donation-added",
    locale,
    tone: "notice",
  });
}

export async function revokeCertificate(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const certificateId = getRequiredString(formData, "certificate_id", "Certificate is required");
  const supabase = createSupabaseAdminClient();

  const { error: revokeError } = await supabase.rpc("revoke_certificate_with_audit", {
    input_admin_user_id: admin.id,
    input_certificate_id: certificateId,
    input_reason: reason,
  });

  if (revokeError) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/certificates",
      formData,
      key: "operation-failed",
      locale,
      tone: "error",
    });
  }

  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/certificates",
    formData,
    key: "certificate-revoked",
    locale,
    tone: "notice",
  });
}
