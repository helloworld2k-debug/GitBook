import { describe, expect, it, vi } from "vitest";
import { checkLicenseRedeemRisk, recordLicenseRedeemAttempt } from "@/lib/license/redeem-security";

function createSecurityClient(options: {
  block?: { blocked_until: string; reason: string } | null;
  ipFailures?: number;
  userFailures?: number;
} = {}) {
  const maybeSingle = vi.fn(async () => ({ data: options.block ?? null, error: null }));
  const countResults = [options.userFailures ?? 0, options.ipFailures ?? 0];
  const selectAttempts = vi.fn(() => {
    const count = countResults.shift() ?? 0;
    const builder = {
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      is: vi.fn(() => builder),
      maybeSingle,
      then: (resolve: (value: { count: number; data: never[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ count, data: [], error: null }).then(resolve, reject),
    };

    return builder;
  });
  const blockBuilder = {
    eq: vi.fn(() => blockBuilder),
    gt: vi.fn(() => blockBuilder),
    limit: vi.fn(() => blockBuilder),
    maybeSingle,
    order: vi.fn(() => blockBuilder),
  };
  const selectBlocks = vi.fn(() => blockBuilder);
  const insert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "license_code_redeem_attempts") return { insert, select: selectAttempts };
    if (table === "license_code_redeem_blocks") {
      return { select: selectBlocks };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, insert, maybeSingle, select: selectAttempts };
}

describe("license redeem security", () => {
  it("blocks a user after five recent failed attempts", async () => {
    const client = createSecurityClient({ userFailures: 5 });

    await expect(checkLicenseRedeemRisk(client, {
      ipAddress: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
      userId: "user-1",
    })).resolves.toEqual({
      ok: false,
      reason: "user_rate_limited",
      retryAfterSeconds: 1800,
    });
  });

  it("blocks an IP after twenty recent failed attempts", async () => {
    const client = createSecurityClient({ ipFailures: 20, userFailures: 0 });

    await expect(checkLicenseRedeemRisk(client, {
      ipAddress: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
      userId: "user-1",
    })).resolves.toEqual({
      ok: false,
      reason: "ip_rate_limited",
      retryAfterSeconds: 1800,
    });
  });

  it("records detailed redemption attempts without storing plaintext codes", async () => {
    const client = createSecurityClient();

    await recordLicenseRedeemAttempt(client, {
      codeHash: "hash-1",
      ipAddress: "203.0.113.10",
      reason: "trial_code_invalid",
      result: "failure",
      userAgent: "Vitest",
      userId: "user-1",
    });

    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      code_hash: "hash-1",
      ip_address: "203.0.113.10",
      reason: "trial_code_invalid",
      result: "failure",
      user_agent: "Vitest",
      user_id: "user-1",
    }));
    expect(JSON.stringify(client.insert.mock.calls)).not.toContain("1MAB-CDEF");
  });
});
