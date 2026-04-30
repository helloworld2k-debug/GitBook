import { NextResponse } from "next/server";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { readCloudSyncLeaseStatus } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feature = url.searchParams.get("feature") || CLOUD_SYNC_FEATURE;

  if (feature !== CLOUD_SYNC_FEATURE) {
    return NextResponse.json({
      authenticated: false,
      feature,
      allowed: false,
      reason: "unsupported_feature",
    });
  }

  const token = readBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        feature,
        allowed: false,
        reason: "not_authenticated",
      },
      { status: 401 },
    );
  }

  try {
    const client = createSupabaseAdminClient();
    const session = await validateDesktopSession(client, token);

    if (!session) {
      return NextResponse.json(
        {
          authenticated: false,
          feature,
          allowed: false,
          reason: "not_authenticated",
        },
        { status: 401 },
      );
    }

    const status = await getLicenseStatus(client, {
      userId: session.user_id,
      machineCodeHash: session.machine_code_hash,
    });

    if (status.allowed) {
      const leaseStatus = await readCloudSyncLeaseStatus(client, {
        desktopSessionId: session.id,
        userId: session.user_id,
      });

      if (!leaseStatus.ok) {
        return NextResponse.json({
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

    return NextResponse.json({
      authenticated: true,
      ...status,
      activeDeviceId: session.device_id,
    });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        feature,
        allowed: false,
        reason: "internal_error",
      },
      { status: 500 },
    );
  }
}
