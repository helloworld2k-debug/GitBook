import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  readBearerToken: vi.fn(),
  refreshDesktopSession: vi.fn(),
  revokeDesktopSession: vi.fn(),
  validateDesktopSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/license/desktop-session", () => ({
  InvalidDesktopSessionError: class InvalidDesktopSessionError extends Error {
    constructor() {
      super("Invalid desktop session");
      this.name = "InvalidDesktopSessionError";
    }
  },
  readBearerToken: mocks.readBearerToken,
  refreshDesktopSession: mocks.refreshDesktopSession,
  revokeDesktopSession: mocks.revokeDesktopSession,
  validateDesktopSession: mocks.validateDesktopSession,
}));

describe("desktop refresh and logout routes", () => {
  const adminClient = { rpc: vi.fn() };

  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    mocks.readBearerToken.mockReset().mockReturnValue("desktop-token");
    mocks.refreshDesktopSession.mockReset().mockResolvedValue({
      desktopSessionId: "session-a",
      expiresAt: "2026-05-31T00:00:00.000Z",
      sessionToken: "new-desktop-token",
      userId: "user-1",
    });
    mocks.revokeDesktopSession.mockReset().mockResolvedValue({ revoked: true });
    mocks.validateDesktopSession.mockReset().mockResolvedValue({
      app_version: "1.0.0",
      device_id: "device-a",
      id: "session-a",
      machine_code_hash: "machine-hash-a",
      platform: "macos",
      user_id: "user-1",
    });
  });

  it("rotates a desktop refresh token", async () => {
    const { POST } = await import("@/app/api/desktop/auth/refresh/route");

    const response = await POST(
      new Request("https://gitbookai.example/api/desktop/auth/refresh", {
        body: JSON.stringify({ refreshToken: "old-refresh-token-value" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      desktopSessionId: "session-a",
      expiresAt: "2026-05-31T00:00:00.000Z",
      token: "new-desktop-token",
      userId: "user-1",
    });
    expect(mocks.refreshDesktopSession).toHaveBeenCalledWith(adminClient, {
      refreshToken: "old-refresh-token-value",
    });
  });

  it("maps invalid refresh tokens to device_replaced", async () => {
    const { InvalidDesktopSessionError } = await import("@/lib/license/desktop-session");
    const { POST } = await import("@/app/api/desktop/auth/refresh/route");

    mocks.refreshDesktopSession.mockRejectedValueOnce(new InvalidDesktopSessionError());

    const response = await POST(
      new Request("https://gitbookai.example/api/desktop/auth/refresh", {
        body: JSON.stringify({ refreshToken: "old-refresh-token-value" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "device_replaced",
        message: "Desktop session has been replaced or revoked.",
      },
    });
  });

  it("logs out the current desktop session", async () => {
    const { POST } = await import("@/app/api/desktop/auth/logout/route");

    const response = await POST(
      new Request("https://gitbookai.example/api/desktop/auth/logout", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revoked: true });
    expect(mocks.revokeDesktopSession).toHaveBeenCalledWith(adminClient, {
      desktopSessionId: "session-a",
    });
  });
});
