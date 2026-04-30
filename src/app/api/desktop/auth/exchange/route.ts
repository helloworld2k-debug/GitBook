import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(20),
  deviceId: z.string().min(4).max(200),
  machineCode: z.string().min(4).max(500),
  platform: z.string().min(2).max(80),
  appVersion: z.string().max(80).optional(),
  deviceName: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = exchangeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid desktop auth exchange request" }, { status: 400 });
  }

  try {
    const result = await exchangeDesktopAuthCode(createSupabaseAdminClient(), parsed.data);

    return NextResponse.json({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      userId: result.userId,
      desktopSessionId: result.desktopSessionId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired desktop auth code" }, { status: 401 });
  }
}
