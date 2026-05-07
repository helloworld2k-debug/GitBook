import { jsonOk } from "@/lib/api/responses";
import { releaseCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
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

    await releaseCloudSyncLease(client, {
      desktopSessionId: session.id,
      userId: session.user_id,
    });

    return jsonOk({ released: true });
  } catch {
    return jsonOk({ released: false, reason: "internal_error" }, 500);
  }
}
