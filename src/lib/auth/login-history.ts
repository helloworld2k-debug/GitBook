import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type LoginHistoryMethod = "email" | "invite" | "magic_link" | "oauth" | "signup";

export function getRequestIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

export function getRequestUserAgent(request: Request) {
  return request.headers.get("user-agent")?.trim() || null;
}

export async function recordUserLoginSafely({
  failureReason = null,
  ip,
  loginMethod,
  success = true,
  userAgent,
  userId,
}: {
  failureReason?: string | null;
  ip: string | null;
  loginMethod: LoginHistoryMethod;
  success?: boolean;
  userAgent: string | null;
  userId: string;
}) {
  try {
    await createSupabaseAdminClient().rpc("record_user_login", {
      p_failure_reason: failureReason ?? undefined,
      p_ip_address: ip,
      p_login_method: loginMethod,
      p_success: success,
      p_user_agent: userAgent?.slice(0, 500) ?? undefined,
      p_user_id: userId,
    });
  } catch {
    // Login history is operational telemetry; auth should not fail because of it.
  }
}
