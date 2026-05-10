import { createRequestId, elapsedMs, logSlowDesktopApi, nowMs } from "@/lib/api/performance";
import { jsonOk } from "@/lib/api/responses";
import { heartbeatCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const totalStart = nowMs();
  let leaseMs: number | undefined;
  let sessionMs: number | undefined;
  const logSlow = (reason: string) =>
    logSlowDesktopApi({
      leaseMs,
      reason,
      requestId,
      route: "/api/license/cloud-sync/heartbeat",
      sessionMs,
      totalMs: elapsedMs(totalStart),
    });
  const token = readBearerToken(request);

  if (!token) {
    logSlow("not_authenticated");
    return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
  }

  try {
    const client = createSupabaseAdminClient();
    const sessionStart = nowMs();
    const session = await validateDesktopSession(client, token);
    sessionMs = elapsedMs(sessionStart);

    if (!session) {
      logSlow("not_authenticated");
      return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
    }

    const leaseStart = nowMs();
    const lease = await heartbeatCloudSyncLease(client, {
      desktopSessionId: session.id,
      userId: session.user_id,
    });
    leaseMs = elapsedMs(leaseStart);

    if (!lease.ok && lease.reason === "invalid_session") {
      logSlow("not_authenticated");
      return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
    }

    if (!lease.ok) {
      logSlow(lease.reason);
      return jsonOk(
        {
          activeDeviceId: lease.activeDeviceId,
          allowed: false,
          reason: lease.reason,
        },
        409,
      );
    }

    logSlow("active");
    return jsonOk({
      activeDeviceId: lease.activeDeviceId,
      allowed: true,
      expiresAt: lease.expiresAt,
      leaseId: lease.leaseId,
      reason: "active",
    });
  } catch {
    logSlow("internal_error");
    return jsonOk({ allowed: false, reason: "internal_error" }, 500);
  }
}
