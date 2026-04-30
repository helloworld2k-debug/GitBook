import { DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";

type Client = { from: (table: string) => any };

type CreateDesktopAuthCodeInput = {
  userId: string;
  deviceSessionId: string;
  returnUrl: string;
  now?: Date;
};

type ExchangeDesktopAuthCodeInput = {
  code: string;
  deviceId: string;
  machineCode: string;
  platform: string;
  appVersion?: string | null;
  deviceName?: string | null;
  now?: Date;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function createDesktopAuthCode(client: Client, input: CreateDesktopAuthCodeInput) {
  const now = input.now ?? new Date();
  const code = generateDesktopSecret();
  const codeHash = await hashDesktopSecret(code, "auth_code");
  const expiresAt = addSeconds(now, DESKTOP_AUTH_CODE_TTL_SECONDS).toISOString();

  const { data, error } = await client
    .from("desktop_auth_codes")
    .insert({
      code_hash: codeHash,
      user_id: input.userId,
      device_session_id: input.deviceSessionId,
      return_url: input.returnUrl,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create desktop auth code");
  }

  return { code, expiresAt };
}

export async function exchangeDesktopAuthCode(client: Client, input: ExchangeDesktopAuthCodeInput) {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const codeHash = await hashDesktopSecret(input.code, "auth_code");
  const machineCodeHash = await hashDesktopSecret(input.machineCode, "machine");
  const sessionToken = generateDesktopSecret();
  const tokenHash = await hashDesktopSecret(sessionToken, "desktop_token");
  const expiresAt = addDays(now, DESKTOP_SESSION_TTL_DAYS).toISOString();

  const { data: authCode, error: codeError } = await client
    .from("desktop_auth_codes")
    .update({ used_at: nowIso })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("id,user_id")
    .single();

  if (codeError || !authCode) {
    throw new Error("Invalid or expired desktop auth code");
  }

  const { error: deviceError } = await client.from("desktop_devices").upsert(
    {
      user_id: authCode.user_id,
      device_id: input.deviceId,
      machine_code_hash: machineCodeHash,
      platform: input.platform,
      app_version: input.appVersion ?? null,
      device_name: input.deviceName ?? null,
      last_seen_at: nowIso,
    },
    { onConflict: "user_id,device_id" },
  );

  if (deviceError) {
    throw new Error("Unable to record desktop device");
  }

  const { data: session, error: sessionError } = await client
    .from("desktop_sessions")
    .insert({
      user_id: authCode.user_id,
      token_hash: tokenHash,
      device_id: input.deviceId,
      machine_code_hash: machineCodeHash,
      platform: input.platform,
      app_version: input.appVersion ?? null,
      last_seen_at: nowIso,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error("Unable to create desktop session");
  }

  return {
    sessionToken,
    expiresAt,
    userId: authCode.user_id,
    desktopSessionId: session.id,
  };
}
