import { DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";
import type { Database } from "@/lib/database.types";

type CreateClient = {
  from: unknown;
};

type CreateDesktopAuthCodeFrom = (table: "desktop_auth_codes") => {
  insert: (payload: {
    code_hash: string;
    user_id: string;
    device_session_id: string;
    return_url: string;
    state: string;
    expires_at: string;
  }) => {
    select: (columns: "id") => {
      single: () => PromiseLike<{ data: { id: string } | null; error: unknown }>;
    };
  };
};

type ExchangeClient = {
  rpc: (
    functionName: "exchange_desktop_auth_code",
    args: Database["public"]["Functions"]["exchange_desktop_auth_code"]["Args"],
  ) => PromiseLike<{
    data: Database["public"]["Functions"]["exchange_desktop_auth_code"]["Returns"] | null;
    error: unknown;
  }>;
};

type CreateDesktopAuthCodeInput = {
  userId: string;
  deviceSessionId: string;
  returnUrl: string;
  state: string;
  now?: Date;
};

type ExchangeDesktopAuthCodeInput = {
  code: string;
  deviceId: string;
  machineCode: string;
  platform: string;
  appVersion?: string | null;
  deviceName?: string | null;
  state: string;
  now?: Date;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export class InvalidDesktopAuthCodeError extends Error {
  constructor() {
    super("Invalid or expired desktop auth code");
    this.name = "InvalidDesktopAuthCodeError";
  }
}

export async function createDesktopAuthCode(client: CreateClient, input: CreateDesktopAuthCodeInput) {
  const now = input.now ?? new Date();
  const code = generateDesktopSecret();
  const codeHash = await hashDesktopSecret(code, "auth_code");
  const expiresAt = addSeconds(now, DESKTOP_AUTH_CODE_TTL_SECONDS).toISOString();
  const from = (table: "desktop_auth_codes") => (client.from as CreateDesktopAuthCodeFrom).call(client, table);

  const { data, error } = await from("desktop_auth_codes")
    .insert({
      code_hash: codeHash,
      user_id: input.userId,
      device_session_id: input.deviceSessionId,
      return_url: input.returnUrl,
      state: input.state,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create desktop auth code");
  }

  return { code, expiresAt };
}

export async function exchangeDesktopAuthCode(client: ExchangeClient, input: ExchangeDesktopAuthCodeInput) {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const codeHash = await hashDesktopSecret(input.code, "auth_code");
  const machineCodeHash = await hashDesktopSecret(input.machineCode, "machine");
  const sessionToken = generateDesktopSecret();
  const tokenHash = await hashDesktopSecret(sessionToken, "desktop_token");
  const expiresAt = addDays(now, DESKTOP_SESSION_TTL_DAYS).toISOString();

  const { data, error } = await client.rpc("exchange_desktop_auth_code", {
    input_app_version: input.appVersion ?? null,
    input_code_hash: codeHash,
    input_device_id: input.deviceId,
    input_device_name: input.deviceName ?? null,
    input_machine_code_hash: machineCodeHash,
    input_now: nowIso,
    input_platform: input.platform,
    input_session_expires_at: expiresAt,
    input_state: input.state,
    input_token_hash: tokenHash,
  });

  if (error) {
    throw new Error("Unable to exchange desktop auth code", { cause: error });
  }

  const row = data?.[0];

  if (!row) {
    throw new InvalidDesktopAuthCodeError();
  }

  return {
    sessionToken,
    expiresAt,
    userId: row.user_id,
    desktopSessionId: row.desktop_session_id,
  };
}
