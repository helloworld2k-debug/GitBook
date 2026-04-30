import { NextResponse } from "next/server";
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

  return NextResponse.json({ error: "PayPal checkout is not enabled yet." }, { status: 503 });
}
