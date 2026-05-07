import { jsonOk } from "@/lib/api/responses";
import { heartbeatCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
  }

  try {
    const client = createSupabaseAdminClient();
    const session = await validateDesktopSession(client, token);

    if (!session) {
      return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
    }

    const status = await getLicenseStatus(client, {
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });

    if (!status.allowed) {
      return jsonOk(
        {
          allowed: false,
          reason: status.reason,
          validUntil: status.validUntil,
        },
        403,
      );
    }

    const lease = await heartbeatCloudSyncLease(client, {
      desktopSessionId: session.id,
      userId: session.user_id,
    });

    if (!lease.ok && lease.reason === "invalid_session") {
      return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
    }

    if (!lease.ok) {
      return jsonOk(
        {
          activeDeviceId: lease.activeDeviceId,
          allowed: false,
          reason: lease.reason,
        },
        409,
      );
    }

    return jsonOk({
      activeDeviceId: lease.activeDeviceId,
      allowed: true,
      expiresAt: lease.expiresAt,
      leaseId: lease.leaseId,
      reason: "active",
    });
  } catch {
    return jsonOk({ allowed: false, reason: "internal_error" }, 500);
  }
}
