import { DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";
import type { Database } from "@/lib/database.types";

type DesktopSessionClient = {
  from: unknown;
};

type DesktopSessionRpcClient = {
  rpc: <FunctionName extends keyof Database["public"]["Functions"]>(
    functionName: FunctionName,
    args: Database["public"]["Functions"][FunctionName]["Args"],
  ) => PromiseLike<{
    data: Database["public"]["Functions"][FunctionName]["Returns"] | null;
    error: unknown;
  }>;
};

type DesktopSessionFrom = (table: "desktop_sessions") => {
  select: (columns: string) => {
    eq: (column: "token_hash", value: string) => {
      maybeSingle: () => PromiseLike<{ data: DesktopSessionRow | null; error: unknown }>;
    };
  };
  update: (payload: { last_seen_at: string }) => {
    eq: (column: "id", value: string) => PromiseLike<unknown> | unknown;
  };
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

type RefreshDesktopSessionInput = {
  refreshToken: string;
  now?: Date;
};

type RevokeDesktopSessionInput = {
  desktopSessionId: string;
  now?: Date;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export class InvalidDesktopSessionError extends Error {
  constructor() {
    super("Invalid desktop session");
    this.name = "InvalidDesktopSessionError";
  }
}

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
  const from = (table: "desktop_sessions") => (client.from as DesktopSessionFrom).call(client, table);
  const { data, error } = await from("desktop_sessions")
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
    await from("desktop_sessions").update({ last_seen_at: now.toISOString() }).eq("id", row.id);
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

export async function refreshDesktopSession(client: DesktopSessionRpcClient, input: RefreshDesktopSessionInput) {
  const now = input.now ?? new Date();
  const currentTokenHash = await hashDesktopSecret(input.refreshToken, "desktop_token");
  const sessionToken = generateDesktopSecret();
  const newTokenHash = await hashDesktopSecret(sessionToken, "desktop_token");
  const expiresAt = addDays(now, DESKTOP_SESSION_TTL_DAYS).toISOString();

  const { data, error } = await client.rpc("refresh_desktop_session", {
    input_current_token_hash: currentTokenHash,
    input_new_expires_at: expiresAt,
    input_new_token_hash: newTokenHash,
    input_now: now.toISOString(),
  });

  if (error) {
    throw new Error("Unable to refresh desktop session");
  }

  const row = data?.[0];

  if (!row) {
    throw new InvalidDesktopSessionError();
  }

  return {
    sessionToken,
    expiresAt,
    userId: row.user_id,
    desktopSessionId: row.desktop_session_id,
  };
}

export async function revokeDesktopSession(client: DesktopSessionRpcClient, input: RevokeDesktopSessionInput) {
  const now = input.now ?? new Date();
  const { data, error } = await client.rpc("revoke_desktop_session_with_leases", {
    input_desktop_session_id: input.desktopSessionId,
    input_now: now.toISOString(),
  });

  if (error || data !== true) {
    throw new Error("Unable to revoke desktop session");
  }

  return { revoked: true };
}
