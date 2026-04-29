import { NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { findDonationTier } from "@/lib/payments/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getSiteOrigin() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL. Set it to your public site URL.");
  }

  return origin;
}

function formatPayPalAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const tier = findDonationTier(formData.get("tier"));
  const origin = getSiteOrigin();

  if (!tier) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/en/login?next=${encodeURIComponent("/en/donate")}`, 303);
  }

  const order = await createPayPalOrder({
    amount: formatPayPalAmount(tier.amount),
    cancelUrl: `${origin}/en/donate?payment=cancelled`,
    currency: tier.currency.toUpperCase(),
    returnUrl: `${origin}/en/dashboard?payment=paypal-return`,
    tierCode: tier.code,
    userId: data.user.id,
  });

  const approvalLink = order.links.find((link) => link.rel === "approve")?.href;

  if (!approvalLink) {
    return NextResponse.json({ error: "Missing PayPal approval link" }, { status: 502 });
  }

  return NextResponse.redirect(approvalLink, 303);
}
