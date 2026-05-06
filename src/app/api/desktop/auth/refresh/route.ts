import { NextResponse } from "next/server";
import { z } from "zod";
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
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Invalid desktop refresh request.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await refreshDesktopSession(createSupabaseAdminClient(), parsed.data);

    return NextResponse.json({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      userId: result.userId,
      desktopSessionId: result.desktopSessionId,
    });
  } catch (error) {
    if (error instanceof InvalidDesktopSessionError) {
      return NextResponse.json(
        {
          error: {
            code: "device_replaced",
            message: "Desktop session has been replaced or revoked.",
          },
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: "Unable to refresh desktop session.",
        },
      },
      { status: 500 },
    );
  }
}
