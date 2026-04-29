import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { buildDonationRecord } from "@/lib/donations/record";
import { findDonationTier } from "@/lib/payments/tier";
import { getStripeWebhookSecret, stripe } from "@/lib/payments/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const tier = session.metadata?.tier;
    const donationTier = findDonationTier(tier ?? null);
    const paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const currency = typeof session.currency === "string" ? session.currency.toLowerCase() : null;

    if (
      !userId ||
      !donationTier ||
      !paymentIntent ||
      session.payment_status !== "paid" ||
      session.amount_total !== donationTier.amount ||
      currency !== donationTier.currency
    ) {
      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const record = buildDonationRecord({
      userId,
      tierCode: donationTier.code,
      amount: donationTier.amount,
      currency: donationTier.currency,
      provider: "stripe",
      providerTransactionId: paymentIntent,
      paidAt: new Date(session.created * 1000),
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
  }

  return NextResponse.json({ received: true });
}
