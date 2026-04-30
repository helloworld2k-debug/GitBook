import { NextResponse } from "next/server";
import { releaseCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
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

    await releaseCloudSyncLease(client, {
      desktopSessionId: session.id,
      userId: session.user_id,
    });

    return NextResponse.json({ released: true });
  } catch {
    return NextResponse.json({ released: false, reason: "internal_error" }, { status: 500 });
  }
}
