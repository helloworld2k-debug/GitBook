"use server";

import { revalidatePath } from "next/cache";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DonationInsert = Database["public"]["Tables"]["donations"]["Insert"];
type Json = Database["public"]["Tables"]["admin_audit_logs"]["Insert"]["before"];

function getSafeLocale(locale: FormDataEntryValue | null) {
  const value = String(locale ?? "en");

  return supportedLocales.includes(value as Locale) ? value : "en";
}

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getRequiredReason(formData: FormData) {
  return getRequiredString(formData, "reason", "Reason is required");
}

async function writeAuditLog(input: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Json;
  after: Json;
  reason: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_user_id: input.adminUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    before: input.before,
    after: input.after,
    reason: input.reason,
  });

  if (error) {
    throw new Error("Unable to write admin audit log");
  }
}

export async function addManualDonation(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
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
    throw new Error("User not found");
  }

  const paidAt = new Date().toISOString();
  const donationRecord: DonationInsert = {
    user_id: profile.id,
    amount,
    currency: "usd",
    provider: "manual",
    provider_transaction_id: `manual_${crypto.randomUUID()}`,
    status: "paid",
    paid_at: paidAt,
    metadata: {
      source: "admin_manual_entry",
      reason,
      admin_user_id: admin.id,
    },
  };

  const { data: donation, error: donationError } = await supabase
    .from("donations")
    .insert(donationRecord)
    .select("*")
    .single();

  if (donationError || !donation) {
    throw new Error("Unable to create manual donation");
  }

  await writeAuditLog({
    adminUserId: admin.id,
    action: "add_manual_donation",
    targetType: "donation",
    targetId: donation.id,
    before: null,
    after: donation,
    reason,
  });

  await generateCertificatesForDonation(donation.id);

  revalidatePath(`/${locale}/admin/donations`);
  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}

export async function revokeCertificate(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const reason = getRequiredReason(formData);
  const certificateId = getRequiredString(formData, "certificate_id", "Certificate is required");
  const supabase = createSupabaseAdminClient();

  const { data: before, error: beforeError } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", certificateId)
    .single();

  if (beforeError || !before) {
    throw new Error("Certificate not found");
  }

  const { data: after, error: updateError } = await supabase
    .from("certificates")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", certificateId)
    .select("*")
    .single();

  if (updateError || !after) {
    throw new Error("Unable to revoke certificate");
  }

  await writeAuditLog({
    adminUserId: admin.id,
    action: "revoke_certificate",
    targetType: "certificate",
    targetId: certificateId,
    before,
    after,
    reason,
  });

  revalidatePath(`/${locale}/admin/certificates`);
  revalidatePath(`/${locale}/admin/audit-logs`);
}
