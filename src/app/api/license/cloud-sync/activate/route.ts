import { NextResponse } from "next/server";
import { activateCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
  }

  try {
    const client = createSupabaseAdminClient();
    const session = await validateDesktopSession(client, token);

    if (!session) {
      return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
    }

    const status = await getLicenseStatus(client, {
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });

    if (!status.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          reason: status.reason,
          validUntil: status.validUntil,
        },
        { status: 403 },
      );
    }

    const lease = await activateCloudSyncLease(client, {
      desktopSessionId: session.id,
      deviceId: session.device_id,
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });

    if (!lease.ok) {
      return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      allowed: true,
      reason: "active",
      leaseId: lease.leaseId,
      expiresAt: lease.expiresAt,
      activeDeviceId: lease.activeDeviceId,
    });
  } catch {
    return NextResponse.json({ allowed: false, reason: "internal_error" }, { status: 500 });
  }
}
