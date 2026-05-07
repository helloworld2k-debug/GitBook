import { NextResponse } from "next/server";
import { supportedLocales, type Locale } from "@/config/site";
import { jsonError } from "@/lib/api/responses";
import { createDodoCheckoutSession, getDodoProductId } from "@/lib/payments/dodo";
import { findActiveDonationTier } from "@/lib/payments/tier";
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
  const origin = getSiteOrigin();
  const locale = getSafeLocale(formData.get("locale"));
  const checkoutStartedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/${locale}/login?next=${encodeURIComponent(`/${locale}/contributions`)}`, 303);
  }

  const tier = await findActiveDonationTier(supabase, formData.get("tier"));

  if (!tier) {
    return jsonError("Invalid donation tier");
  }

  const productId = getDodoProductId(tier.code);

  if (!productId) {
    return jsonError("Invalid donation tier");
  }

  const session = await createDodoCheckoutSession({
    cancel_url: `${origin}/${locale}/contributions?payment=cancelled&checkout_started_at=${encodeURIComponent(checkoutStartedAt)}`,
    customer: {
      email: data.user.email,
    },
    feature_flags: {
      redirect_immediately: true,
    },
    metadata: {
      amount: String(tier.amount),
      ...(tier.compareAtAmount ? { compare_at_amount: String(tier.compareAtAmount) } : {}),
      currency: tier.currency,
      ...(tier.id ? { donation_tier_id: tier.id } : {}),
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
    return_url: `${origin}/${locale}/dashboard/certificates/latest?payment=dodo-success&checkout_started_at=${encodeURIComponent(checkoutStartedAt)}`,
  });

  if (!session.checkout_url) {
    return jsonError("Unable to create checkout", 502);
  }

  return NextResponse.redirect(session.checkout_url, 303);
}
