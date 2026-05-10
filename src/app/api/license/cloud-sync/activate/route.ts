import { createRequestId, elapsedMs, logSlowDesktopApi, nowMs } from "@/lib/api/performance";
import { jsonOk } from "@/lib/api/responses";
import { activateCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const totalStart = nowMs();
  let entitlementMs: number | undefined;
  let leaseMs: number | undefined;
  let sessionMs: number | undefined;
  const logSlow = (reason: string) =>
    logSlowDesktopApi({
      entitlementMs,
      leaseMs,
      reason,
      requestId,
      route: "/api/license/cloud-sync/activate",
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

    const entitlementStart = nowMs();
    const status = await getLicenseStatus(client, {
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });
    entitlementMs = elapsedMs(entitlementStart);

    if (!status.allowed) {
      logSlow(status.reason);
      return jsonOk(
        {
          allowed: false,
          reason: status.reason,
          validUntil: status.validUntil,
        },
        403,
      );
    }

    const leaseStart = nowMs();
    const lease = await activateCloudSyncLease(client, {
      desktopSessionId: session.id,
      deviceId: session.device_id,
      machineCodeHash: session.machine_code_hash,
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
          availableAfter: lease.availableAfter,
          reason: lease.reason,
          remainingSeconds: lease.remainingSeconds,
        },
        409,
      );
    }

    logSlow("active");
    return jsonOk({
      allowed: true,
      reason: "active",
      leaseId: lease.leaseId,
      expiresAt: lease.expiresAt,
      activeDeviceId: lease.activeDeviceId,
      overrideId: lease.overrideId,
    });
  } catch {
    logSlow("internal_error");
    return jsonOk({ allowed: false, reason: "internal_error" }, 500);
  }
}
