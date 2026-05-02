import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  activateCloudSyncLease: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getLicenseStatus: vi.fn(),
  heartbeatCloudSyncLease: vi.fn(),
  readBearerToken: vi.fn(),
  releaseCloudSyncLease: vi.fn(),
  readCloudSyncLeaseStatus: vi.fn(),
  validateDesktopSession: vi.fn(),
}));

vi.mock("@/lib/license/cloud-sync-leases", () => ({
  activateCloudSyncLease: routeMocks.activateCloudSyncLease,
  heartbeatCloudSyncLease: routeMocks.heartbeatCloudSyncLease,
  releaseCloudSyncLease: routeMocks.releaseCloudSyncLease,
  readCloudSyncLeaseStatus: routeMocks.readCloudSyncLeaseStatus,
}));

vi.mock("@/lib/license/desktop-session", () => ({
  readBearerToken: routeMocks.readBearerToken,
  validateDesktopSession: routeMocks.validateDesktopSession,
}));

vi.mock("@/lib/license/status", () => ({
  getLicenseStatus: routeMocks.getLicenseStatus,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: routeMocks.createSupabaseAdminClient,
}));

const activeSession = {
  id: "session-a",
  user_id: "user-1",
  device_id: "device-a",
  machine_code_hash: "machine-hash-a",
  platform: "macos",
  app_version: "1.0.0",
};

describe("cloud sync lease service", () => {
  it("activates a lease through the atomic RPC and returns camel-cased lease fields", async () => {
    const { activateCloudSyncLease } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const now = new Date("2026-05-01T00:00:00.000Z");
    const rpc = vi.fn(async () => ({
      data: [
        {
          active_device_id: "device-a",
          expires_at: "2026-05-01T00:02:00.000Z",
          lease_id: "lease-a",
          ok: true,
          reason: "active",
        },
      ],
      error: null,
    }));

    await expect(
      activateCloudSyncLease(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          deviceId: "device-a",
          machineCodeHash: "machine-hash-a",
          now,
        },
      ),
    ).resolves.toEqual({
      activeDeviceId: "device-a",
      expiresAt: "2026-05-01T00:02:00.000Z",
      leaseId: "lease-a",
      ok: true,
      reason: "active",
    });

    expect(rpc).toHaveBeenCalledWith("activate_cloud_sync_lease", {
      input_desktop_session_id: "session-a",
      input_device_id: "device-a",
      input_expires_at: "2026-05-01T00:02:00.000Z",
      input_machine_code_hash: "machine-hash-a",
      input_now: "2026-05-01T00:00:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("returns an invalid-session denial when activation loses the desktop session race", async () => {
    const { activateCloudSyncLease } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const rpc = vi.fn(async () => ({
      data: [
        {
          active_device_id: null,
          expires_at: null,
          lease_id: null,
          ok: false,
          reason: "invalid_session",
        },
      ],
      error: null,
    }));

    await expect(
      activateCloudSyncLease(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          deviceId: "device-a",
          machineCodeHash: "machine-hash-a",
          now: new Date("2026-05-01T00:00:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      activeDeviceId: null,
      expiresAt: null,
      leaseId: null,
      ok: false,
      reason: "invalid_session",
    });
  });

  it("extends the current session lease on heartbeat", async () => {
    const { heartbeatCloudSyncLease } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const now = new Date("2026-05-01T00:01:00.000Z");
    const rpc = vi.fn(async () => ({
      data: [
        {
          active_device_id: "device-a",
          expires_at: "2026-05-01T00:03:00.000Z",
          lease_id: "lease-a",
          ok: true,
          reason: "active",
        },
      ],
      error: null,
    }));

    await expect(
      heartbeatCloudSyncLease(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          now,
        },
      ),
    ).resolves.toEqual({
      activeDeviceId: "device-a",
      expiresAt: "2026-05-01T00:03:00.000Z",
      leaseId: "lease-a",
      ok: true,
      reason: "active",
    });
  });

  it("returns the active competing device when heartbeat belongs to a stale session", async () => {
    const { heartbeatCloudSyncLease } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const rpc = vi.fn(async () => ({
      data: [
        {
          active_device_id: "device-b",
          expires_at: null,
          lease_id: null,
          ok: false,
          reason: "active_on_another_device",
        },
      ],
      error: null,
    }));

    await expect(
      heartbeatCloudSyncLease(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          now: new Date("2026-05-01T00:01:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      activeDeviceId: "device-b",
      expiresAt: null,
      leaseId: null,
      ok: false,
      reason: "active_on_another_device",
    });
  });

  it("releases the current session lease through the atomic RPC", async () => {
    const { releaseCloudSyncLease } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await expect(
      releaseCloudSyncLease(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          now: new Date("2026-05-01T00:01:00.000Z"),
        },
      ),
    ).resolves.toEqual({ released: true });

    expect(rpc).toHaveBeenCalledWith("release_cloud_sync_lease", {
      input_desktop_session_id: "session-a",
      input_now: "2026-05-01T00:01:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("reads active lease status without extending the lease", async () => {
    const { readCloudSyncLeaseStatus } =
      await vi.importActual<typeof import("@/lib/license/cloud-sync-leases")>("@/lib/license/cloud-sync-leases");
    const rpc = vi.fn(async () => ({
      data: [
        {
          active_device_id: "device-b",
          ok: false,
          reason: "active_on_another_device",
        },
      ],
      error: null,
    }));

    await expect(
      readCloudSyncLeaseStatus(
        { rpc },
        {
          userId: "user-1",
          desktopSessionId: "session-a",
          now: new Date("2026-05-01T00:01:00.000Z"),
        },
      ),
    ).resolves.toEqual({
      activeDeviceId: "device-b",
      ok: false,
      reason: "active_on_another_device",
    });

    expect(rpc).toHaveBeenCalledWith("read_cloud_sync_lease_status", {
      input_desktop_session_id: "session-a",
      input_now: "2026-05-01T00:01:00.000Z",
      input_user_id: "user-1",
    });
  });
});

describe("cloud sync lease routes", () => {
  const adminClient = { rpc: vi.fn() };

  beforeEach(() => {
    routeMocks.activateCloudSyncLease.mockReset().mockResolvedValue({
      activeDeviceId: "device-a",
      expiresAt: "2026-05-01T00:02:00.000Z",
      leaseId: "lease-a",
      ok: true,
      reason: "active",
    });
    routeMocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    routeMocks.getLicenseStatus.mockReset().mockResolvedValue({
      allowed: true,
      feature: "cloud_sync",
      reason: "active",
      remainingDays: 30,
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
    });
    routeMocks.heartbeatCloudSyncLease.mockReset().mockResolvedValue({
      activeDeviceId: "device-a",
      expiresAt: "2026-05-01T00:03:00.000Z",
      leaseId: "lease-a",
      ok: true,
      reason: "active",
    });
    routeMocks.readBearerToken.mockReset().mockReturnValue("desktop-token");
    routeMocks.releaseCloudSyncLease.mockReset().mockResolvedValue({ released: true });
    routeMocks.readCloudSyncLeaseStatus.mockReset().mockResolvedValue({
      activeDeviceId: "device-a",
      ok: true,
      reason: "active",
    });
    routeMocks.validateDesktopSession.mockReset().mockResolvedValue(activeSession);
  });

  it("activates cloud sync for an entitled desktop session", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/activate/route");

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/activate", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activeDeviceId: "device-a",
      allowed: true,
      expiresAt: "2026-05-01T00:02:00.000Z",
      leaseId: "lease-a",
      reason: "active",
    });
    expect(routeMocks.getLicenseStatus).toHaveBeenCalledWith(adminClient, {
      machineCodeHash: "machine-hash-a",
      userId: "user-1",
    });
    expect(routeMocks.activateCloudSyncLease).toHaveBeenCalledWith(adminClient, {
      desktopSessionId: "session-a",
      deviceId: "device-a",
      machineCodeHash: "machine-hash-a",
      userId: "user-1",
    });
  });

  it("rejects activation when the desktop token is missing or invalid", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/activate/route");

    routeMocks.readBearerToken.mockReturnValueOnce(null);

    const missingToken = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/activate", { method: "POST" }),
    );

    expect(missingToken.status).toBe(401);
    await expect(missingToken.json()).resolves.toEqual({ allowed: false, reason: "not_authenticated" });

    routeMocks.validateDesktopSession.mockResolvedValueOnce(null);

    const invalidToken = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/activate", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(invalidToken.status).toBe(401);
    await expect(invalidToken.json()).resolves.toEqual({ allowed: false, reason: "not_authenticated" });
    expect(routeMocks.activateCloudSyncLease).not.toHaveBeenCalled();
  });

  it("rejects activation when license status is not allowed", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/activate/route");

    routeMocks.getLicenseStatus.mockResolvedValueOnce({
      allowed: false,
      feature: "cloud_sync",
      reason: "expired",
      remainingDays: 0,
      validUntil: "2026-05-01T00:00:00.000Z",
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/activate", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: "expired",
      validUntil: "2026-05-01T00:00:00.000Z",
    });
    expect(routeMocks.activateCloudSyncLease).not.toHaveBeenCalled();
  });

  it("maps an activation session race to not_authenticated", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/activate/route");

    routeMocks.activateCloudSyncLease.mockResolvedValueOnce({
      activeDeviceId: null,
      expiresAt: null,
      leaseId: null,
      ok: false,
      reason: "invalid_session",
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/activate", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: "not_authenticated",
    });
  });

  it("extends heartbeat for the active lease and returns the active device", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/heartbeat/route");

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/heartbeat", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activeDeviceId: "device-a",
      allowed: true,
      expiresAt: "2026-05-01T00:03:00.000Z",
      leaseId: "lease-a",
      reason: "active",
    });
  });

  it("returns 409 on heartbeat when another device owns cloud sync", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/heartbeat/route");

    routeMocks.heartbeatCloudSyncLease.mockResolvedValueOnce({
      activeDeviceId: "device-b",
      expiresAt: null,
      leaseId: null,
      ok: false,
      reason: "active_on_another_device",
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/heartbeat", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      activeDeviceId: "device-b",
      allowed: false,
      reason: "active_on_another_device",
    });
  });

  it("maps a heartbeat session race to not_authenticated", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/heartbeat/route");

    routeMocks.heartbeatCloudSyncLease.mockResolvedValueOnce({
      activeDeviceId: null,
      expiresAt: null,
      leaseId: null,
      ok: false,
      reason: "invalid_session",
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/heartbeat", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: "not_authenticated",
    });
  });

  it("rejects heartbeat when entitlement has expired", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/heartbeat/route");

    routeMocks.getLicenseStatus.mockResolvedValueOnce({
      allowed: false,
      feature: "cloud_sync",
      reason: "trial_expired",
      remainingDays: 0,
      validUntil: "2026-05-01T00:00:00.000Z",
    });

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/heartbeat", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      allowed: false,
      reason: "trial_expired",
      validUntil: "2026-05-01T00:00:00.000Z",
    });
    expect(routeMocks.heartbeatCloudSyncLease).not.toHaveBeenCalled();
  });

  it("releases the current session lease without checking entitlement", async () => {
    const { POST } = await import("@/app/api/license/cloud-sync/release/route");

    const response = await POST(
      new Request("https://gitbookai.example/api/license/cloud-sync/release", {
        headers: { authorization: "Bearer desktop-token" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ released: true });
    expect(routeMocks.getLicenseStatus).not.toHaveBeenCalled();
    expect(routeMocks.releaseCloudSyncLease).toHaveBeenCalledWith(adminClient, {
      desktopSessionId: "session-a",
      userId: "user-1",
    });
  });

  it("status route reports when another device has taken over cloud sync", async () => {
    const { GET } = await import("@/app/api/license/status/route");

    routeMocks.readCloudSyncLeaseStatus.mockResolvedValueOnce({
      activeDeviceId: "device-b",
      ok: false,
      reason: "active_on_another_device",
    });

    const response = await GET(
      new Request("https://gitbookai.example/api/license/status", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activeDeviceId: "device-b",
      allowed: false,
      authenticated: true,
      feature: "cloud_sync",
      reason: "active_on_another_device",
      remainingDays: 0,
      validUntil: "2026-05-31T00:00:00.000Z",
    });
  });
});
