import { NextResponse } from "next/server";
import { supportedLocales, type Locale } from "@/config/site";
import { findDonationTier } from "@/lib/payments/tier";
import { stripe } from "@/lib/payments/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getSiteOrigin() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL. Set it to your public site URL.");
  }

  return origin;
}

function getSafeLocale(value: FormDataEntryValue | null) {
  const locale = String(value ?? "en");

  return supportedLocales.includes(locale as Locale) ? locale : "en";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const tier = findDonationTier(formData.get("tier"));
  const origin = getSiteOrigin();
  const locale = getSafeLocale(formData.get("locale"));

  if (!tier) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/${locale}/login?next=${encodeURIComponent(`/${locale}/donate`)}`, 303);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: tier.currency,
          unit_amount: tier.amount,
          product_data: { name: `GitBook AI ${tier.code} support` },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/${locale}/dashboard?payment=stripe-success`,
    cancel_url: `${origin}/${locale}/donate?payment=cancelled`,
    metadata: {
      user_id: data.user.id,
      tier: tier.code,
      amount: String(tier.amount),
      currency: tier.currency,
    },
  });

  return NextResponse.redirect(session.url!, 303);
}
