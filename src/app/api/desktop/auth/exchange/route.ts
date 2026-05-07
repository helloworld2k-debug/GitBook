import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { exchangeDesktopAuthCode, InvalidDesktopAuthCodeError } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(20),
  deviceId: z.string().min(4).max(200),
  machineCode: z.string().min(4).max(500),
  platform: z.string().min(2).max(80),
  state: z.string().min(8).max(300),
  appVersion: z.string().max(80).optional(),
  deviceName: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = exchangeSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Invalid desktop auth exchange request");
  }

  try {
    const result = await exchangeDesktopAuthCode(createSupabaseAdminClient(), parsed.data);

    return jsonOk({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      userId: result.userId,
      desktopSessionId: result.desktopSessionId,
    });
  } catch (error) {
    if (error instanceof InvalidDesktopAuthCodeError) {
      return jsonError("Invalid or expired desktop auth code", 401);
    }

    return jsonError("Unable to exchange desktop auth code", 500);
  }
}
