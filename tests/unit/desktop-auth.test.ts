import { describe, expect, it, vi } from "vitest";
import { DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { createDesktopAuthCode, exchangeDesktopAuthCode } from "@/lib/license/desktop-auth";

describe("desktop auth", () => {
  it("creates a single-use auth code record and returns the raw code once", async () => {
    const insertSingle = vi.fn(async () => ({ data: { id: "code-1" }, error: null }));
    const select = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };
    const now = new Date("2026-05-01T00:00:00.000Z");

    const result = await createDesktopAuthCode(client, {
      userId: "user-1",
      deviceSessionId: "desktop-flow-1",
      returnUrl: "gitbookai://auth/callback",
      now,
    });

    expect(result.code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.expiresAt).toBe(new Date(now.getTime() + DESKTOP_AUTH_CODE_TTL_SECONDS * 1000).toISOString());
    expect(result).not.toHaveProperty("codeHash");
    expect(client.from).toHaveBeenCalledWith("desktop_auth_codes");
    expect(insert).toHaveBeenCalledWith({
      code_hash: await hashDesktopSecret(result.code, "auth_code"),
      user_id: "user-1",
      device_session_id: "desktop-flow-1",
      return_url: "gitbookai://auth/callback",
      expires_at: "2026-05-01T00:05:00.000Z",
    });
  });

  it("exchanges a valid code for a desktop session token and records device metadata", async () => {
    const now = new Date("2026-05-01T00:01:00.000Z");
    const authCode = {
      id: "auth-code-1",
      user_id: "user-1",
    };
    const authCodeSingle = vi.fn(async () => ({ data: authCode, error: null }));
    const sessionSingle = vi.fn(async () => ({ data: { id: "session-1" }, error: null }));
    const authCodeClaimSingle = vi.fn(() => authCodeSingle());
    const authCodeClaimSelect = vi.fn(() => ({ single: authCodeClaimSingle }));
    const authCodeClaimGt = vi.fn(() => ({ select: authCodeClaimSelect }));
    const authCodeClaimIs = vi.fn(() => ({ gt: authCodeClaimGt }));
    const authCodeClaimEq = vi.fn(() => ({ is: authCodeClaimIs }));
    const authCodeUpdate = vi.fn(() => ({ eq: authCodeClaimEq }));
    const upsert = vi.fn(async () => ({ error: null }));
    const insertSelect = vi.fn(() => ({ single: sessionSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const from = vi.fn((table: string) => {
      if (table === "desktop_auth_codes") {
        return {
          update: authCodeUpdate,
        };
      }
      if (table === "desktop_devices") {
        return { upsert };
      }
      if (table === "desktop_sessions") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await exchangeDesktopAuthCode(
      { from },
      {
        code: "raw-code",
        deviceId: "device-a",
        machineCode: "MACHINE-A",
        platform: "macos",
        appVersion: "1.0.0",
        deviceName: "Studio Mac",
        now,
      },
    );

    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.expiresAt).toBe("2026-05-31T00:01:00.000Z");
    expect(result.userId).toBe("user-1");
    expect(result.desktopSessionId).toBe("session-1");
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        device_id: "device-a",
        machine_code_hash: await hashDesktopSecret("MACHINE-A", "machine"),
        platform: "macos",
        app_version: "1.0.0",
        device_name: "Studio Mac",
        last_seen_at: "2026-05-01T00:01:00.000Z",
      },
      { onConflict: "user_id,device_id" },
    );
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      token_hash: await hashDesktopSecret(result.sessionToken, "desktop_token"),
      device_id: "device-a",
      machine_code_hash: await hashDesktopSecret("MACHINE-A", "machine"),
      platform: "macos",
      app_version: "1.0.0",
      last_seen_at: "2026-05-01T00:01:00.000Z",
      expires_at: new Date(now.getTime() + DESKTOP_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(authCodeUpdate).toHaveBeenCalledWith({ used_at: "2026-05-01T00:01:00.000Z" });
    expect(authCodeClaimEq).toHaveBeenCalledWith("code_hash", await hashDesktopSecret("raw-code", "auth_code"));
    expect(authCodeClaimIs).toHaveBeenCalledWith("used_at", null);
    expect(authCodeClaimGt).toHaveBeenCalledWith("expires_at", "2026-05-01T00:01:00.000Z");
  });
});
