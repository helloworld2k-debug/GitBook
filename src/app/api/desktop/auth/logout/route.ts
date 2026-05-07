import { jsonPayload } from "@/lib/api/responses";
import { readBearerToken, revokeDesktopSession, validateDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return jsonPayload(
      {
        error: {
          code: "session_revoked",
          message: "Desktop session is not active.",
        },
      },
      401,
    );
  }

  try {
    const client = createSupabaseAdminClient();
    const session = await validateDesktopSession(client, token);

    if (!session) {
      return jsonPayload(
        {
          error: {
            code: "session_revoked",
            message: "Desktop session is not active.",
          },
        },
        401,
      );
    }

    const result = await revokeDesktopSession(client, { desktopSessionId: session.id });

    return jsonPayload(result);
  } catch {
    return jsonPayload(
      {
        error: {
          code: "internal_error",
          message: "Unable to log out desktop session.",
        },
      },
      500,
    );
  }
}
