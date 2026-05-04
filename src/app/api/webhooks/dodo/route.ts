import { NextResponse } from "next/server";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { buildDonationRecord } from "@/lib/donations/record";
import type { Json } from "@/lib/database.types";
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
import { getDodoProductId, verifyDodoWebhook } from "@/lib/payments/dodo";
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

function getPositiveIntegerString(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function getProductId(data: Record<string, unknown>) {
  const cart = Array.isArray(data.product_cart) ? data.product_cart : [];
  const firstItem = getObject(cart[0]);

  return getString(firstItem.product_id);
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
    const productId = getProductId(data);
    const expectedProductId = donationTier ? getDodoProductId(donationTier.code) : null;
    const expectedAmount = getPositiveIntegerString(metadata.amount) ?? donationTier?.amount ?? null;

    if (
      !userId ||
      !donationTier ||
      !paymentId ||
      !amount ||
      amount <= 0 ||
      !currency ||
      (productId && productId !== expectedProductId) ||
      (!productId && expectedAmount !== null && amount !== expectedAmount)
    ) {
      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const paidAt = new Date(getPaidAt(data));
    const record = buildDonationRecord({
      userId,
      tierCode: donationTier.code,
      amount,
      currency,
      provider: "dodo",
      providerTransactionId: paymentId,
      paidAt,
    });
    record.metadata = {
      expected_amount: expectedAmount,
      paid_amount: amount,
      product_id: productId,
      tier: donationTier.code,
    } satisfies Json;
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
