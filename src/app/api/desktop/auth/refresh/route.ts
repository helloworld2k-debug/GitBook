import { z } from "zod";
import { jsonPayload } from "@/lib/api/responses";
import { InvalidDesktopSessionError, refreshDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return jsonPayload(
      {
        error: {
          code: "invalid_request",
          message: "Invalid desktop refresh request.",
        },
      },
      400,
    );
  }

  try {
    const result = await refreshDesktopSession(createSupabaseAdminClient(), parsed.data);

    return jsonPayload({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      userId: result.userId,
      desktopSessionId: result.desktopSessionId,
    });
  } catch (error) {
    if (error instanceof InvalidDesktopSessionError) {
      return jsonPayload(
        {
          error: {
            code: "device_replaced",
            message: "Desktop session has been replaced or revoked.",
          },
        },
        401,
      );
    }

    return jsonPayload(
      {
        error: {
          code: "internal_error",
          message: "Unable to refresh desktop session.",
        },
      },
      500,
    );
  }
}
