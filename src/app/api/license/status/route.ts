import { createRequestId, elapsedMs, logSlowDesktopApi, nowMs } from "@/lib/api/performance";
import { jsonOk } from "@/lib/api/responses";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { readCloudSyncLeaseStatus } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
      route: "/api/license/status",
      sessionMs,
      totalMs: elapsedMs(totalStart),
    });
  const url = new URL(request.url);
  const feature = url.searchParams.get("feature") || CLOUD_SYNC_FEATURE;

  if (feature !== CLOUD_SYNC_FEATURE) {
    logSlow("unsupported_feature");
    return jsonOk({
      authenticated: false,
      feature,
      allowed: false,
      reason: "unsupported_feature",
    });
  }

  const token = readBearerToken(request);

  if (!token) {
    logSlow("not_authenticated");
    return jsonOk(
      {
        authenticated: false,
        feature,
        allowed: false,
        reason: "not_authenticated",
      },
      401,
    );
  }

  try {
    const client = createSupabaseAdminClient();
    const sessionStart = nowMs();
    const session = await validateDesktopSession(client, token);
    sessionMs = elapsedMs(sessionStart);

    if (!session) {
      logSlow("not_authenticated");
      return jsonOk(
        {
          authenticated: false,
          feature,
          allowed: false,
          reason: "not_authenticated",
        },
        401,
      );
    }

    const entitlementStart = nowMs();
    const status = await getLicenseStatus(client, {
      userId: session.user_id,
      machineCodeHash: session.machine_code_hash,
    });
    entitlementMs = elapsedMs(entitlementStart);

    if (status.allowed) {
      const leaseStart = nowMs();
      const leaseStatus = await readCloudSyncLeaseStatus(client, {
        desktopSessionId: session.id,
        userId: session.user_id,
      });
      leaseMs = elapsedMs(leaseStart);

      if (!leaseStatus.ok) {
        logSlow(leaseStatus.reason);
        return jsonOk({
          authenticated: true,
          feature,
          allowed: false,
          reason: leaseStatus.reason,
          validUntil: status.validUntil,
          remainingDays: 0,
          activeDeviceId: leaseStatus.activeDeviceId,
        });
      }
    }

    logSlow(status.reason);
    return jsonOk({
      authenticated: true,
      ...status,
      activeDeviceId: session.device_id,
    });
  } catch {
    logSlow("internal_error");
    return jsonOk(
      {
        authenticated: false,
        feature,
        allowed: false,
        reason: "internal_error",
      },
      500,
    );
  }
}
