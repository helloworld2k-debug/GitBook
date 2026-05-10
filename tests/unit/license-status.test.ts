import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/license/status/route";
import { hashDesktopSecret } from "@/lib/license/hash";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";

const routeMocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: routeMocks.createSupabaseAdminClient,
}));

type ChainState = {
  filters: Array<[string, unknown]>;
  selectColumns: string | null;
  updatePayload: unknown;
};

function rowMatchesFilters(row: unknown, filters: Array<[string, unknown]>) {
  if (!row || typeof row !== "object") {
    return filters.length === 0;
  }

  return filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value);
}

function createMaybeSingleClient(
  tableRows: Record<string, unknown> | Record<string, unknown[]>,
  tableErrors: Record<string, unknown> = {},
  tableUpdateErrors: Record<string, unknown> = {},
) {
  const states = new Map<string, ChainState>();
  const rpc = vi.fn(async (functionName: string) => {
    if (functionName === "read_cloud_sync_lease_status") {
      return {
        data: [
          {
            active_device_id: null,
            ok: true,
            reason: "active",
          },
        ],
        error: null,
      };
    }

    return { data: null, error: new Error(`Unexpected RPC: ${functionName}`) };
  });

  const from = vi.fn((table: string) => {
    const state = states.get(table) ?? { filters: [], selectColumns: null, updatePayload: null };
    states.set(table, state);

    const builder = {
      eq: vi.fn((column: string, value: unknown) => {
        state.filters.push([column, value]);
        return builder;
      }),
      maybeSingle: vi.fn(async () => {
        const rows = tableRows[table];
        const data = Array.isArray(rows) ? rows.find((row) => rowMatchesFilters(row, state.filters)) ?? null : rows ?? null;

        return { data, error: tableErrors[table] ?? null };
      }),
      select: vi.fn((columns: string) => {
        state.selectColumns = columns;
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        state.updatePayload = payload;
        if (tableUpdateErrors[table]) {
          throw tableUpdateErrors[table];
        }
        return builder;
      }),
    };

    return builder;
  });

  return { from, rpc, states };
}

describe("getLicenseStatus", () => {
  it("allows active paid entitlement with source paid", async () => {
    const client = createMaybeSingleClient({
      license_entitlements: {
        status: "active",
        valid_until: "2026-05-31T00:00:00.000Z",
      },
    });

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: true,
      feature: "cloud_sync",
      reason: "active",
      remainingDays: 30,
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
    });
    expect(client.from).not.toHaveBeenCalledWith("machine_trial_claims");
  });

  it("allows active machine trial with source trial", async () => {
    const client = createMaybeSingleClient({
      machine_trial_claims: {
        trial_valid_until: "2026-05-04T00:00:00.000Z",
      },
    });

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: true,
      feature: "cloud_sync",
      reason: "trial_active",
      remainingDays: 3,
      source: "trial",
      validUntil: "2026-05-04T00:00:00.000Z",
    });
    expect(client.states.get("machine_trial_claims")?.filters).toEqual([
      ["machine_code_hash", "machine-hash-1"],
      ["feature_code", "cloud_sync"],
      ["user_id", "user-1"],
    ]);
  });

  it("does not allow a machine trial claimed by a different user", async () => {
    const client = createMaybeSingleClient({
      machine_trial_claims: [
        {
          feature_code: "cloud_sync",
          machine_code_hash: "machine-hash-1",
          trial_valid_until: "2026-05-04T00:00:00.000Z",
          user_id: "user-1",
        },
      ],
    });

    const status = await getLicenseStatus(client, {
      userId: "user-2",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: false,
      feature: "cloud_sync",
      reason: "trial_code_required",
      remainingDays: 0,
      validUntil: null,
    });
  });

  it("allows active machine trial when a paid entitlement is expired", async () => {
    const client = createMaybeSingleClient({
      license_entitlements: {
        status: "active",
        valid_until: "2026-04-30T00:00:00.000Z",
      },
      machine_trial_claims: {
        trial_valid_until: "2026-05-04T00:00:00.000Z",
      },
    });

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: true,
      feature: "cloud_sync",
      reason: "trial_active",
      remainingDays: 3,
      source: "trial",
      validUntil: "2026-05-04T00:00:00.000Z",
    });
  });

  it("does not allow active machine trial to bypass a revoked paid entitlement", async () => {
    const client = createMaybeSingleClient({
      license_entitlements: {
        status: "revoked",
        valid_until: "2026-05-31T00:00:00.000Z",
      },
      machine_trial_claims: {
        trial_valid_until: "2026-05-04T00:00:00.000Z",
      },
    });

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: false,
      feature: "cloud_sync",
      reason: "revoked",
      remainingDays: 0,
      validUntil: "2026-05-31T00:00:00.000Z",
    });
    expect(client.from).not.toHaveBeenCalledWith("machine_trial_claims");
  });

  it("requires a trial code when there is no paid entitlement or trial", async () => {
    const client = createMaybeSingleClient({});

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: false,
      feature: "cloud_sync",
      reason: "trial_code_required",
      remainingDays: 0,
      validUntil: null,
    });
  });

  it("denies expired machine trials", async () => {
    const client = createMaybeSingleClient({
      machine_trial_claims: {
        trial_valid_until: "2026-05-01T00:00:00.000Z",
      },
    });

    const status = await getLicenseStatus(client, {
      userId: "user-1",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status).toEqual({
      allowed: false,
      feature: "cloud_sync",
      reason: "trial_expired",
      remainingDays: 0,
      validUntil: "2026-05-01T00:00:00.000Z",
    });
  });
});

describe("desktop session helpers", () => {
  it("reads bearer authorization tokens case-insensitively", () => {
    expect(
      readBearerToken(
        new Request("https://gitbookai.example/api/license/status", {
          headers: { authorization: "Bearer desktop-token" },
        }),
      ),
    ).toBe("desktop-token");
    expect(
      readBearerToken(
        new Request("https://gitbookai.example/api/license/status", {
          headers: { Authorization: "bearer another-token" },
        }),
      ),
    ).toBe("another-token");
  });

  it("returns null for malformed bearer authorization headers", () => {
    const requestWithAuthorization = (authorization: string) =>
      new Request("https://gitbookai.example/api/license/status", {
        headers: { authorization },
      });

    expect(readBearerToken(requestWithAuthorization("desktop-token"))).toBeNull();
    expect(readBearerToken(requestWithAuthorization("Bearer"))).toBeNull();
    expect(readBearerToken(requestWithAuthorization("Bearer "))).toBeNull();
    expect(readBearerToken(requestWithAuthorization("Bearer  desktop-token"))).toBeNull();
    expect(readBearerToken(requestWithAuthorization("Bearer desktop token"))).toBeNull();
    expect(readBearerToken(requestWithAuthorization("Bearer desktop-token extra"))).toBeNull();
  });

  it("returns null for missing, expired, and revoked sessions", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");

    await expect(validateDesktopSession(createMaybeSingleClient({}), "", now)).resolves.toBeNull();
    await expect(
      validateDesktopSession(
        createMaybeSingleClient({
          desktop_sessions: {
            id: "session-1",
            user_id: "user-1",
            device_id: "device-a",
            machine_code_hash: "machine-hash-1",
            platform: "macos",
            app_version: "1.0.0",
            expires_at: "2026-05-01T00:00:00.000Z",
            revoked_at: null,
          },
        }),
        "desktop-token",
        now,
      ),
    ).resolves.toBeNull();
    await expect(
      validateDesktopSession(
        createMaybeSingleClient({
          desktop_sessions: {
            id: "session-1",
            user_id: "user-1",
            device_id: "device-a",
            machine_code_hash: "machine-hash-1",
            platform: "macos",
            app_version: "1.0.0",
            expires_at: "2026-05-02T00:00:00.000Z",
            revoked_at: "2026-05-01T00:00:00.000Z",
          },
        }),
        "desktop-token",
        now,
      ),
    ).resolves.toBeNull();
  });

  it("updates last_seen_at and returns public fields for a valid desktop session", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const client = createMaybeSingleClient({
      desktop_sessions: {
        id: "session-1",
        user_id: "user-1",
        device_id: "device-a",
        machine_code_hash: "machine-hash-1",
        platform: "macos",
        app_version: "1.0.0",
        last_seen_at: "2026-04-30T23:40:00.000Z",
        expires_at: "2026-05-02T00:00:00.000Z",
        revoked_at: null,
      },
    });

    await expect(validateDesktopSession(client, "desktop-token", now)).resolves.toEqual({
      id: "session-1",
      user_id: "user-1",
      device_id: "device-a",
      machine_code_hash: "machine-hash-1",
      platform: "macos",
      app_version: "1.0.0",
    });
    expect(client.states.get("desktop_sessions")?.filters).toContainEqual([
      "token_hash",
      await hashDesktopSecret("desktop-token", "desktop_token"),
    ]);
    expect(client.states.get("desktop_sessions")?.filters).toContainEqual(["id", "session-1"]);
    expect(client.states.get("desktop_sessions")?.updatePayload).toEqual({
      last_seen_at: "2026-05-01T00:00:00.000Z",
    });
  });

  it("does not update last_seen_at for recently touched desktop sessions", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const client = createMaybeSingleClient({
      desktop_sessions: {
        id: "session-1",
        user_id: "user-1",
        device_id: "device-a",
        machine_code_hash: "machine-hash-1",
        platform: "macos",
        app_version: "1.0.0",
        last_seen_at: "2026-04-30T23:57:00.000Z",
        expires_at: "2026-05-02T00:00:00.000Z",
        revoked_at: null,
      },
    });

    await expect(validateDesktopSession(client, "desktop-token", now)).resolves.toEqual({
      id: "session-1",
      user_id: "user-1",
      device_id: "device-a",
      machine_code_hash: "machine-hash-1",
      platform: "macos",
      app_version: "1.0.0",
    });
    expect(client.states.get("desktop_sessions")?.updatePayload).toBeNull();
  });

  it("returns a valid desktop session when the last_seen_at update fails", async () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const client = createMaybeSingleClient(
      {
        desktop_sessions: {
          id: "session-1",
          user_id: "user-1",
          device_id: "device-a",
          machine_code_hash: "machine-hash-1",
          platform: "macos",
          app_version: "1.0.0",
          last_seen_at: "2026-04-30T23:40:00.000Z",
          expires_at: "2026-05-02T00:00:00.000Z",
          revoked_at: null,
        },
      },
      {},
      { desktop_sessions: new Error("update failed") },
    );

    await expect(validateDesktopSession(client, "desktop-token", now)).resolves.toEqual({
      id: "session-1",
      user_id: "user-1",
      device_id: "device-a",
      machine_code_hash: "machine-hash-1",
      platform: "macos",
      app_version: "1.0.0",
    });
    expect(client.states.get("desktop_sessions")?.updatePayload).toEqual({
      last_seen_at: "2026-05-01T00:00:00.000Z",
    });
  });
});

describe("license status route", () => {
  beforeEach(() => {
    routeMocks.createSupabaseAdminClient.mockReset().mockReturnValue(
      createMaybeSingleClient({
        desktop_sessions: {
          id: "session-1",
          user_id: "user-1",
          device_id: "device-a",
          machine_code_hash: "machine-hash-1",
          platform: "macos",
          app_version: "1.0.0",
          expires_at: "2026-05-31T00:00:00.000Z",
          revoked_at: null,
        },
        license_entitlements: {
          status: "active",
          valid_until: "2026-05-31T00:00:00.000Z",
        },
      }),
    );
  });

  it("returns unsupported_feature for non-cloud-sync feature queries", async () => {
    const response = await GET(new Request("https://gitbookai.example/api/license/status?feature=other"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      allowed: false,
      feature: "other",
      reason: "unsupported_feature",
    });
    expect(routeMocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 401 for missing or invalid desktop tokens", async () => {
    let response = await GET(new Request("https://gitbookai.example/api/license/status"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      allowed: false,
      feature: "cloud_sync",
      reason: "not_authenticated",
    });

    routeMocks.createSupabaseAdminClient.mockReturnValueOnce(createMaybeSingleClient({}));
    response = await GET(
      new Request("https://gitbookai.example/api/license/status", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      allowed: false,
      feature: "cloud_sync",
      reason: "not_authenticated",
    });
  });

  it("returns authenticated license status for valid desktop tokens", async () => {
    const response = await GET(
      new Request("https://gitbookai.example/api/license/status", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      activeDeviceId: "device-a",
      allowed: true,
      feature: "cloud_sync",
      reason: "active",
      remainingDays: expect.any(Number),
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
    });
  });

  it("returns a generic 500 response for internal errors", async () => {
    routeMocks.createSupabaseAdminClient.mockReturnValueOnce(
      createMaybeSingleClient(
        {
          desktop_sessions: {
            id: "session-1",
            user_id: "user-1",
            device_id: "device-a",
            machine_code_hash: "machine-hash-1",
            platform: "macos",
            app_version: "1.0.0",
            expires_at: "2026-05-31T00:00:00.000Z",
            revoked_at: null,
          },
        },
        { license_entitlements: new Error("database unavailable") },
      ),
    );

    const response = await GET(
      new Request("https://gitbookai.example/api/license/status", {
        headers: { authorization: "Bearer desktop-token" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      allowed: false,
      feature: "cloud_sync",
      reason: "internal_error",
    });
  });
});
