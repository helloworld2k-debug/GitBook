import { NextResponse } from "next/server";
import { readBearerToken, revokeDesktopSession, validateDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "session_revoked",
          message: "Desktop session is not active.",
        },
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
          error: {
            code: "session_revoked",
            message: "Desktop session is not active.",
          },
        },
        { status: 401 },
      );
    }

    const result = await revokeDesktopSession(client, { desktopSessionId: session.id });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: "Unable to log out desktop session.",
        },
      },
      { status: 500 },
    );
  }
}
