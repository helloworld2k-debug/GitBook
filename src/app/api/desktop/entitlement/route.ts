import { NextResponse } from "next/server";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import type { LicenseStatus } from "@/lib/license/status";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function mapEntitlementReason(status: LicenseStatus) {
  if (status.allowed) {
    return "active";
  }

  if (status.reason === "expired" || status.reason === "trial_expired") {
    return "support_expired";
  }

  if (status.reason === "revoked") {
    return "session_revoked";
  }

  return "support_required";
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return errorResponse("session_revoked", "Desktop session is not active.", 401);
  }

  try {
    const client = createSupabaseAdminClient();
    const session = await validateDesktopSession(client, token);

    if (!session) {
      return errorResponse("session_revoked", "Desktop session is not active.", 401);
    }

    const status = await getLicenseStatus(client, {
      machineCodeHash: session.machine_code_hash,
      userId: session.user_id,
    });
    const now = new Date();

    return NextResponse.json({
      user: {
        id: session.user_id,
      },
      device: {
        session_id: session.id,
        status: "active",
        platform: session.platform,
      },
      entitlement: {
        cloud_sync_available: status.allowed,
        support_active: status.allowed,
        support_expires_at: status.validUntil,
        reason: mapEntitlementReason(status),
        check_after: addHours(now, status.allowed ? 6 : 1).toISOString(),
      },
    });
  } catch {
    return errorResponse("internal_error", "Unable to read desktop entitlement.", 500);
  }
}
