import { describe, expect, it, vi } from "vitest";
import { hashDesktopSecret } from "@/lib/license/hash";
import { redeemLicenseCode, redeemTrialCode } from "@/lib/license/trial-codes";

function createTrialClient(row: { ok: boolean; reason: string; valid_until: string | null } | null, error: unknown = null) {
  return {
    rpc: vi.fn(async () => ({ data: row ? [row] : [], error })),
  };
}

describe("redeemTrialCode", () => {
  it("redeems a general license code through the unified RPC", async () => {
    const client = createTrialClient({
      ok: true,
      reason: "redeemed",
      valid_until: "2026-06-01T00:00:00.000Z",
    });
    const now = new Date("2026-05-01T00:00:00.000Z");

    const result = await redeemLicenseCode(client, {
      userId: "user-1",
      code: "1MAB-CDEF-GHJK-LMNP",
      now,
    });

    expect(result).toEqual({ ok: true, validUntil: "2026-06-01T00:00:00.000Z" });
    expect(client.rpc).toHaveBeenCalledWith("redeem_license_code", {
      input_code_hash: await hashDesktopSecret("1MAB-CDEF-GHJK-LMNP", "trial_code"),
      input_machine_code_hash: null,
      input_now: "2026-05-01T00:00:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("passes machine hashes to support account-or-device trial abuse checks", async () => {
    const client = createTrialClient({
      ok: false,
      reason: "duplicate_trial_code_machine",
      valid_until: null,
    });

    const result = await redeemLicenseCode(client, {
      userId: "user-1",
      code: "T3AB-CDEF-GHJK-LMNP",
      machineCodeHash: "machine-hash-1",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_trial_code_machine" });
    expect(client.rpc).toHaveBeenCalledWith("redeem_license_code", expect.objectContaining({
      input_machine_code_hash: "machine-hash-1",
    }));
  });

  it("returns a valid redemption and calls the account-first RPC with a hashed code", async () => {
    const client = createTrialClient({
      ok: true,
      reason: "redeemed",
      valid_until: "2026-05-04T00:00:00.000Z",
    });
    const now = new Date("2026-05-01T00:00:00.000Z");

    const result = await redeemTrialCode(client, {
      userId: "user-1",
      code: "SPRING-2026",
      now,
    });

    expect(result).toEqual({ ok: true, validUntil: "2026-05-04T00:00:00.000Z" });
    expect(client.rpc).toHaveBeenCalledWith("redeem_license_code", {
      input_code_hash: await hashDesktopSecret("SPRING-2026", "trial_code"),
      input_machine_code_hash: null,
      input_now: "2026-05-01T00:00:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("maps an inactive code to an inactive trial failure", async () => {
    const client = createTrialClient({
      ok: false,
      reason: "trial_code_inactive",
      valid_until: null,
    });

    const result = await redeemTrialCode(client, {
      userId: "user-1",
      code: "SPRING-2026",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: false, reason: "trial_code_inactive" });
  });

  it.each([
    "trial_code_invalid",
    "trial_code_limit_reached",
    "duplicate_trial_code_user",
  ] as const)("maps %s failures from the RPC", async (reason) => {
    const client = createTrialClient({
      ok: false,
      reason,
      valid_until: null,
    });

    await expect(
      redeemTrialCode(client, {
        userId: "user-1",
        code: "SPRING-2026",
        now: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it("throws when the RPC fails", async () => {
    const client = createTrialClient(null, new Error("database unavailable"));

    await expect(
      redeemTrialCode(client, {
        userId: "user-1",
        code: "SPRING-2026",
      }),
    ).rejects.toThrow("Unable to redeem trial code");
  });

  it("throws when the RPC reports success without a valid-until value", async () => {
    const client = createTrialClient({
      ok: true,
      reason: "redeemed",
      valid_until: null,
    });

    await expect(
      redeemTrialCode(client, {
        userId: "user-1",
        code: "SPRING-2026",
      }),
    ).rejects.toThrow("Trial code redemption response was malformed");
  });
});
