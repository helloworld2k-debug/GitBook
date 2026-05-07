import { jsonOk } from "@/lib/api/responses";
import { activateCloudSyncLease } from "@/lib/license/cloud-sync-leases";
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

    const lease = await activateCloudSyncLease(client, {
      desktopSessionId: session.id,
      deviceId: session.device_id,
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });

    if (!lease.ok) {
      return jsonOk({ allowed: false, reason: "not_authenticated" }, 401);
    }

    return jsonOk({
      allowed: true,
      reason: "active",
      leaseId: lease.leaseId,
      expiresAt: lease.expiresAt,
      activeDeviceId: lease.activeDeviceId,
    });
  } catch {
    return jsonOk({ allowed: false, reason: "internal_error" }, 500);
  }
}
