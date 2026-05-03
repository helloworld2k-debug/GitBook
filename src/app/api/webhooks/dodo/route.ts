import { NextResponse } from "next/server";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { buildDonationRecord } from "@/lib/donations/record";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { verifyDodoWebhook } from "@/lib/payments/dodo";
import { findDonationTier } from "@/lib/payments/tier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function getPaidAt(data: Record<string, unknown>) {
  return getString(data.created_at) ?? getString(data.createdAt) ?? new Date().toISOString();
}

export async function POST(request: Request) {
  const body = await request.text();
  let event;

  try {
    event = verifyDodoWebhook(body, request.headers);
  } catch {
    return NextResponse.json({ error: "Invalid Dodo signature" }, { status: 400 });
  }

  if (event.type === "payment.succeeded") {
    const data = getObject(event.data);
    const metadata = getObject(data.metadata);
    const userId = getString(metadata.user_id);
    const tierCode = getString(metadata.tier);
    const donationTier = findDonationTier(tierCode);
    const paymentId = getString(data.payment_id) ?? getString(data.id);
    const amount = getNumber(data.total_amount) ?? getNumber(data.amount);
    const currency = getString(data.currency)?.toLowerCase() ?? null;

    if (
      !userId ||
      !donationTier ||
      !paymentId ||
      amount !== donationTier.amount ||
      currency !== donationTier.currency
    ) {
      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const paidAt = new Date(getPaidAt(data));
    const record = buildDonationRecord({
      userId,
      tierCode: donationTier.code,
      amount: donationTier.amount,
      currency: donationTier.currency,
      provider: "dodo",
      providerTransactionId: paymentId,
      paidAt,
    });
    const { data: donation, error } = await supabase
      .from("donations")
      .upsert(record, { onConflict: "provider,provider_transaction_id" })
      .select("id")
      .single();

    if (error || !donation) {
      return NextResponse.json({ error: "Unable to save donation" }, { status: 500 });
    }

    await generateCertificatesForDonation(donation.id);
    await extendCloudSyncEntitlementForDonation(supabase, {
      userId,
      donationId: donation.id,
      tierCode: donationTier.code,
      paidAt,
    });
  }

  return NextResponse.json({ received: true });
}
