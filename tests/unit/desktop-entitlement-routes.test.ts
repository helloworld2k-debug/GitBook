import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getLicenseStatus: vi.fn(),
  readBearerToken: vi.fn(),
  validateDesktopSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/license/desktop-session", () => ({
  readBearerToken: mocks.readBearerToken,
  validateDesktopSession: mocks.validateDesktopSession,
}));

vi.mock("@/lib/license/status", () => ({
  getLicenseStatus: mocks.getLicenseStatus,
}));

const activeSession = {
  app_version: "1.0.0",
  device_id: "device-a",
  id: "session-a",
  machine_code_hash: "machine-hash-a",
  platform: "macos",
  user_id: "user-1",
};

describe("desktop entitlement route", () => {
  const adminClient = { from: vi.fn() };

  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    mocks.getLicenseStatus.mockReset().mockResolvedValue({
      allowed: true,
      feature: "cloud_sync",
      reason: "active",
      remainingDays: 30,
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
    });
    mocks.readBearerToken.mockReset().mockReturnValue("desktop-token");
    mocks.validateDesktopSession.mockReset().mockResolvedValue(activeSession);
  });

  it("returns the software-facing cloud sync entitlement shape", async () => {
    const { GET } = await import("@/app/api/desktop/entitlement/route");

    const response = await GET(
      new Request("https://gitbookai.example/api/desktop/entitlement", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      device: {
        platform: "macos",
        session_id: "session-a",
        status: "active",
      },
      entitlement: {
        check_after: expect.any(String),
        cloud_sync_available: true,
        reason: "active",
        support_active: true,
        support_expires_at: "2026-05-31T00:00:00.000Z",
      },
      user: {
        id: "user-1",
      },
    });
    expect(mocks.getLicenseStatus).toHaveBeenCalledWith(adminClient, {
      machineCodeHash: "machine-hash-a",
      userId: "user-1",
    });
  });

  it("maps missing paid support to support_required", async () => {
    const { GET } = await import("@/app/api/desktop/entitlement/route");

    mocks.getLicenseStatus.mockResolvedValueOnce({
      allowed: false,
      feature: "cloud_sync",
      reason: "trial_code_required",
      remainingDays: 0,
      validUntil: null,
    });

    const response = await GET(
      new Request("https://gitbookai.example/api/desktop/entitlement", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entitlement: {
        cloud_sync_available: false,
        reason: "support_required",
        support_active: false,
        support_expires_at: null,
      },
    });
  });

  it("maps expired paid support to support_expired", async () => {
    const { GET } = await import("@/app/api/desktop/entitlement/route");

    mocks.getLicenseStatus.mockResolvedValueOnce({
      allowed: false,
      feature: "cloud_sync",
      reason: "expired",
      remainingDays: 0,
      validUntil: "2026-05-01T00:00:00.000Z",
    });

    const response = await GET(
      new Request("https://gitbookai.example/api/desktop/entitlement", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entitlement: {
        cloud_sync_available: false,
        reason: "support_expired",
        support_active: false,
        support_expires_at: "2026-05-01T00:00:00.000Z",
      },
    });
  });

  it("returns session_revoked when the desktop token is invalid", async () => {
    const { GET } = await import("@/app/api/desktop/entitlement/route");

    mocks.validateDesktopSession.mockResolvedValueOnce(null);

    const response = await GET(
      new Request("https://gitbookai.example/api/desktop/entitlement", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "session_revoked",
        message: "Desktop session is not active.",
      },
    });
  });
});
