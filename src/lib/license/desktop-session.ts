import { hashDesktopSecret } from "@/lib/license/hash";

type DesktopSessionClient = {
  from: (table: string) => any;
};

type DesktopSessionRow = {
  id: string;
  user_id: string;
  device_id: string;
  machine_code_hash: string;
  platform: string;
  app_version: string | null;
  expires_at: string;
  revoked_at: string | null;
};

export type ValidDesktopSession = Pick<
  DesktopSessionRow,
  "id" | "user_id" | "device_id" | "machine_code_hash" | "platform" | "app_version"
>;

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^bearer ([^\s]+)$/i);

  return match?.[1] ?? null;
}

export async function validateDesktopSession(
  client: DesktopSessionClient,
  token: string | null | undefined,
  now = new Date(),
): Promise<ValidDesktopSession | null> {
  if (!token) {
    return null;
  }

  const tokenHash = await hashDesktopSecret(token, "desktop_token");
  const { data, error } = await client
    .from("desktop_sessions")
    .select("id,user_id,device_id,machine_code_hash,platform,app_version,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as DesktopSessionRow;

  if (row.revoked_at || new Date(row.expires_at) <= now) {
    return null;
  }

  try {
    await client.from("desktop_sessions").update({ last_seen_at: now.toISOString() }).eq("id", row.id);
  } catch {
    // last_seen_at is telemetry; a valid session should not fail auth because touch failed.
  }

  return {
    id: row.id,
    user_id: row.user_id,
    device_id: row.device_id,
    machine_code_hash: row.machine_code_hash,
    platform: row.platform,
    app_version: row.app_version,
  };
}
