import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const debugInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      DODO_PAYMENTS_ENV: process.env.DODO_PAYMENTS_ENV,
      DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY ? "已设置" : "未设置",
      DODO_PAYMENTS_WEBHOOK_KEY: process.env.DODO_PAYMENTS_WEBHOOK_KEY ? "已设置" : "未设置",
      DODO_PRODUCT_ONE_DAY: process.env.DODO_PRODUCT_ONE_DAY ? "已设置" : "未设置",
      DODO_PRODUCT_MONTHLY: process.env.DODO_PRODUCT_MONTHLY ? "已设置" : "未设置",
      DODO_PRODUCT_QUARTERLY: process.env.DODO_PRODUCT_QUARTERLY ? "已设置" : "未设置",
      DODO_PRODUCT_YEARLY: process.env.DODO_PRODUCT_YEARLY ? "已设置" : "未设置",
      DODO_LIVE_PRODUCT_ONE_DAY: process.env.DODO_LIVE_PRODUCT_ONE_DAY ? "已设置" : "未设置",
      DODO_LIVE_PRODUCT_MONTHLY: process.env.DODO_LIVE_PRODUCT_MONTHLY ? "已设置" : "未设置",
      DODO_LIVE_PRODUCT_QUARTERLY: process.env.DODO_LIVE_PRODUCT_QUARTERLY ? "已设置" : "未设置",
      DODO_LIVE_PRODUCT_YEARLY: process.env.DODO_LIVE_PRODUCT_YEARLY ? "已设置" : "未设置",
    },
    webhook: {
      expected_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/dodo`,
    },
  };

  // 检查最近的 donations
  const supabase = createSupabaseAdminClient();
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

  // 检查最近的 webhook logs
  const { data: recentWebhookLogs, error: webhookLogsError } = await supabase
    .from("webhook_logs")
    .select("id,source,event_type,status,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  debugInfo.recentWebhookLogs = recentWebhookLogs ?? [];
  debugInfo.webhookLogsError = webhookLogsError?.message;

  const { error: accountTypeSchemaError } = await supabase
    .from("profiles")
    .select("account_type")
    .limit(1);

  debugInfo.schemaStatus = {
    profiles_account_type: {
      code: accountTypeSchemaError?.code ?? null,
      message: accountTypeSchemaError?.message ? "schema check failed" : null,
      status: accountTypeSchemaError ? "fail" : "pass",
    },
  };

  return NextResponse.json(debugInfo);
}
