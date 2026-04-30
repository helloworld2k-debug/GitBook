import { describe, expect, it, vi } from "vitest";
import { extendCloudSyncEntitlementForDonation, getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

type CurrentEntitlement = {
  id: string;
  valid_until: string;
  status: string;
  source_donation_id: string | null;
} | null;

function createEntitlementClient(current: CurrentEntitlement, rpcValidUntil = "2026-05-31T00:00:00.000Z") {
  const entitlementMaybeSingle = vi.fn(async () => ({
    data: current,
    error: null,
  }));
  const entitlementSelect = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle: entitlementMaybeSingle }) }) }));
  const rpc = vi.fn(async () => ({ data: rpcValidUntil, error: null }));

  const from = vi.fn((table: string) => {
    if (table === "license_entitlements") {
      return { select: entitlementSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    entitlementMaybeSingle,
    entitlementSelect,
    from,
    rpc,
  };
}

describe("extendCloudSyncEntitlementForDonation", () => {
  it("delegates monthly grants to the atomic entitlement RPC", async () => {
    const client = createEntitlementClient(null);

    const validUntil = await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-1",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(validUntil).toBe("2026-05-31T00:00:00.000Z");
    expect(client.rpc).toHaveBeenCalledWith("grant_cloud_sync_entitlement_for_donation", {
      input_days: 30,
      input_donation_id: "donation-1",
      input_paid_at: "2026-05-01T00:00:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("delegates yearly grants to the same RPC so stacking is handled atomically", async () => {
    const client = createEntitlementClient(null, "2027-05-21T00:00:00.000Z");

    const validUntil = await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-2",
      tierCode: "yearly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(validUntil).toBe("2027-05-21T00:00:00.000Z");
    expect(client.rpc).toHaveBeenCalledWith("grant_cloud_sync_entitlement_for_donation", {
      input_days: 365,
      input_donation_id: "donation-2",
      input_paid_at: "2026-05-01T00:00:00.000Z",
      input_user_id: "user-1",
    });
  });

  it("rejects unknown tiers", async () => {
    const client = createEntitlementClient(null);

    await expect(
      extendCloudSyncEntitlementForDonation(client, {
        userId: "user-1",
        donationId: "donation-1",
        tierCode: "lifetime",
        paidAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Unsupported entitlement tier");
  });

  it("returns the RPC value so repeated donation IDs are idempotent in the grant ledger", async () => {
    const client = createEntitlementClient(null, "2026-05-31T00:00:00.000Z");

    const validUntil = await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-1",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(validUntil).toBe("2026-05-31T00:00:00.000Z");
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("getCloudSyncEntitlementStatus", () => {
  it("returns active when valid_until is in the future", async () => {
    const client = createEntitlementClient({
      id: "entitlement-1",
      source_donation_id: "donation-1",
      status: "active",
      valid_until: "2026-05-31T00:00:00.000Z",
    });

    const status = await getCloudSyncEntitlementStatus(client, "user-1", new Date("2026-05-01T00:00:00.000Z"));

    expect(status).toEqual({
      allowed: true,
      reason: "active",
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
      remainingDays: 30,
    });
  });

  it("returns expired when valid_until is in the past", async () => {
    const client = createEntitlementClient({
      id: "entitlement-1",
      source_donation_id: "donation-1",
      status: "active",
      valid_until: "2026-04-30T00:00:00.000Z",
    });

    const status = await getCloudSyncEntitlementStatus(client, "user-1", new Date("2026-05-01T00:00:00.000Z"));

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe("expired");
  });
});
