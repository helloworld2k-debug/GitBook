import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { findDonationTier } from "@/lib/payments/tier";
import { stripe } from "@/lib/payments/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getFallbackOrigin() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL. Set it to your public site URL.");
  }

  return origin;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const tier = findDonationTier(formData.get("tier"));
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? getFallbackOrigin();

  if (!tier) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/en/login?next=${encodeURIComponent("/en/donate")}`, 303);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: tier.currency,
          unit_amount: tier.amount,
          product_data: { name: `Three Friends ${tier.code} support` },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/en/dashboard?payment=stripe-success`,
    cancel_url: `${origin}/en/donate?payment=cancelled`,
    metadata: {
      user_id: data.user.id,
      tier: tier.code,
      amount: String(tier.amount),
      currency: tier.currency,
    },
  });

  return NextResponse.redirect(session.url!, 303);
}
