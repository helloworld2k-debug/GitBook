import { NextResponse } from "next/server";
import { supportedLocales, type Locale } from "@/config/site";
import { createDodoCheckoutSession, getDodoProductId } from "@/lib/payments/dodo";
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
    return NextResponse.redirect(`${origin}/${locale}/login?next=${encodeURIComponent(`/${locale}/contributions`)}`, 303);
  }

  const productId = getDodoProductId(tier.code);

  if (!productId) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const session = await createDodoCheckoutSession({
    cancel_url: `${origin}/${locale}/contributions?payment=cancelled`,
    customer: {
      email: data.user.email,
    },
    feature_flags: {
      redirect_immediately: true,
    },
    metadata: {
      amount: String(tier.amount),
      currency: tier.currency,
      tier: tier.code,
      user_id: data.user.id,
    },
    payment_link: true,
    product_cart: [
      {
        product_id: productId,
        quantity: 1,
      },
    ],
    return_url: `${origin}/${locale}/dashboard/certificates/latest?payment=dodo-success`,
  });

  if (!session.checkout_url) {
    return NextResponse.json({ error: "Unable to create checkout" }, { status: 502 });
  }

  return NextResponse.redirect(session.checkout_url, 303);
}
