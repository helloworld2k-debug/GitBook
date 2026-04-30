import { describe, expect, it, vi } from "vitest";
import { extendCloudSyncEntitlementForDonation, getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

type CurrentEntitlement = {
  id: string;
  valid_until: string;
  status: string;
  source_donation_id: string | null;
} | null;

function createEntitlementClient(current: CurrentEntitlement) {
  const maybeSingle = vi.fn(async () => ({
    data: current,
    error: null,
  }));
  const select = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }));
  const upsertSingle = vi.fn(async () => ({ data: { id: "entitlement-1" }, error: null }));
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const from = vi.fn(() => ({ select, upsert }));

  return { from, maybeSingle, select, upsert, upsertSelect, upsertSingle };
}

describe("extendCloudSyncEntitlementForDonation", () => {
  it("starts from paidAt when no current entitlement exists", async () => {
    const client = createEntitlementClient(null);

    await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-1",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        feature_code: "cloud_sync",
        valid_until: "2026-05-31T00:00:00.000Z",
        source_donation_id: "donation-1",
        status: "active",
      }),
      { onConflict: "user_id,feature_code" },
    );
  });

  it("stacks from the current valid_until when entitlement is active", async () => {
    const client = createEntitlementClient({
      id: "entitlement-1",
      source_donation_id: "donation-1",
      status: "active",
      valid_until: "2026-05-21T00:00:00.000Z",
    });

    await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-2",
      tierCode: "yearly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        valid_until: "2027-05-21T00:00:00.000Z",
      }),
      { onConflict: "user_id,feature_code" },
    );
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

  it("does not extend again for the same donation ID", async () => {
    const client = createEntitlementClient({
      id: "entitlement-1",
      source_donation_id: "donation-1",
      status: "active",
      valid_until: "2026-05-31T00:00:00.000Z",
    });

    const validUntil = await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-1",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(validUntil).toBe("2026-05-31T00:00:00.000Z");
    expect(client.upsert).not.toHaveBeenCalled();
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
