import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const debugInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      DODO_PAYMENTS_ENV: process.env.DODO_PAYMENTS_ENV,
      DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY ? "已设置" : "未设置",
      DODO_PAYMENTS_WEBHOOK_KEY: process.env.DODO_PAYMENTS_WEBHOOK_KEY ? "已设置" : "未设置",
      DODO_PRODUCT_MONTHLY: process.env.DODO_PRODUCT_MONTHLY ? "已设置" : "未设置",
      DODO_PRODUCT_QUARTERLY: process.env.DODO_PRODUCT_QUARTERLY ? "已设置" :未设置",
      DODO_PRODUCT_YEARLY: process.env.DODO_PRODUCT_YEARLY ? "已设置" : "未设置",
    },
    webhook: {
      expected_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/dodo`,
    },
  };

  // 检查最近的 donations
  const supabase = createSupabaseServerClient();
  const { data: recentDonations, error: donationsError } = await supabase
    .from("donations")
    .select("id,amount,currency,status,paid_at,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(10);

  debugInfo.recentDonations = recentDonations ?? [];
  debugInfo.donationsError = donationsError?.message;

  // 检查最近的 entitlements
  const { data: recentEntitlements, error: entitlementsError } = await supabase
    .from("license_entitlements")
    .select("*")
    .eq("feature_code", "cloud_sync")
    .order("created_at", { ascending: false })
    .limit(10);

  debugInfo.recentEntitlements = recentEntitlements ?? [];
  debugInfo.entitlementsError = entitlementsError?.message;

  return NextResponse.json(debugInfo);
}