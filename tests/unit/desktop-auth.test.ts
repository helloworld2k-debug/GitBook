import { describe, expect, it, vi } from "vitest";
import { DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import {
  createDesktopAuthCode,
  exchangeDesktopAuthCode,
  InvalidDesktopAuthCodeError,
} from "@/lib/license/desktop-auth";

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
    const rpc = vi.fn(async () => ({
      data: [
        {
          desktop_session_id: "session-1",
          user_id: "user-1",
        },
      ],
      error: null,
    }));
    const client = {
      rpc,
    };

    const result = await exchangeDesktopAuthCode(client, {
      code: "raw-code",
      deviceId: "device-a",
      machineCode: "MACHINE-A",
      platform: "macos",
      appVersion: "1.0.0",
      deviceName: "Studio Mac",
      now,
    });

    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.expiresAt).toBe("2026-05-31T00:01:00.000Z");
    expect(result.userId).toBe("user-1");
    expect(result.desktopSessionId).toBe("session-1");
    expect(rpc).toHaveBeenCalledWith("exchange_desktop_auth_code", {
      input_app_version: "1.0.0",
      input_code_hash: await hashDesktopSecret("raw-code", "auth_code"),
      input_device_id: "device-a",
      input_device_name: "Studio Mac",
      input_machine_code_hash: await hashDesktopSecret("MACHINE-A", "machine"),
      input_now: "2026-05-01T00:01:00.000Z",
      input_platform: "macos",
      input_session_expires_at: new Date(now.getTime() + DESKTOP_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      input_token_hash: await hashDesktopSecret(result.sessionToken, "desktop_token"),
    });
  });

  it("throws a typed invalid-code error when the exchange RPC returns no row", async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: [], error: null })),
    };

    await expect(
      exchangeDesktopAuthCode(client, {
        code: "raw-code",
        deviceId: "device-a",
        machineCode: "MACHINE-A",
        platform: "macos",
        now: new Date("2026-05-01T00:01:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(InvalidDesktopAuthCodeError);
  });

  it("throws a generic internal error when the exchange RPC fails", async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: new Error("database unavailable") })),
    };

    await expect(
      exchangeDesktopAuthCode(client, {
        code: "raw-code",
        deviceId: "device-a",
        machineCode: "MACHINE-A",
        platform: "macos",
        now: new Date("2026-05-01T00:01:00.000Z"),
      }),
    ).rejects.toThrow("Unable to exchange desktop auth code");
  });
});
