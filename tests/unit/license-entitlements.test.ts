import { describe, expect, it, vi } from "vitest";
import { extendCloudSyncEntitlementForDonation, getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

type CurrentEntitlement = {
  id: string;
  valid_until: string;
  status: string;
  source_donation_id: string | null;
} | null;

type DonationMetadata = Record<string, unknown> | null;

function createEntitlementClient(current: CurrentEntitlement, donationMetadata: DonationMetadata = {}) {
  const entitlementMaybeSingle = vi.fn(async () => ({
    data: current,
    error: null,
  }));
  const entitlementSelect = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle: entitlementMaybeSingle }) }) }));
  const upsertSingle = vi.fn(async () => ({ data: { id: "entitlement-1" }, error: null }));
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));

  const donationSingle = vi.fn(async () => ({
    data: { metadata: donationMetadata },
    error: null,
  }));
  const donationSelectEq = vi.fn(() => ({ single: donationSingle }));
  const donationSelect = vi.fn(() => ({ eq: donationSelectEq }));
  const donationUpdateEq = vi.fn(async () => ({ error: null }));
  const donationUpdate = vi.fn(() => ({ eq: donationUpdateEq }));

  const from = vi.fn((table: string) => {
    if (table === "license_entitlements") {
      return { select: entitlementSelect, upsert };
    }

    if (table === "donations") {
      return { select: donationSelect, update: donationUpdate };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    donationSelect,
    donationSelectEq,
    donationSingle,
    donationUpdate,
    donationUpdateEq,
    entitlementMaybeSingle,
    entitlementSelect,
    from,
    upsert,
    upsertSelect,
    upsertSingle,
  };
}

describe("extendCloudSyncEntitlementForDonation", () => {
  it("starts from paidAt when no current entitlement exists", async () => {
    const client = createEntitlementClient(null, { receipt_number: "R-100" });

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
    expect(client.donationUpdate).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        receipt_number: "R-100",
        cloud_sync_entitlement_granted_at: expect.any(String),
        cloud_sync_entitlement_valid_until: "2026-05-31T00:00:00.000Z",
      }),
    });
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

  it("does not extend again when an earlier donation retries after a later donation overwrote the entitlement source", async () => {
    const client = createEntitlementClient(
      {
        id: "entitlement-1",
        source_donation_id: "donation-b",
        status: "active",
        valid_until: "2026-06-30T00:00:00.000Z",
      },
      {
        receipt_number: "R-100",
        cloud_sync_entitlement_granted_at: "2026-05-01T00:00:01.000Z",
        cloud_sync_entitlement_valid_until: "2026-05-31T00:00:00.000Z",
      },
    );

    const validUntil = await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-a",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(validUntil).toBe("2026-05-31T00:00:00.000Z");
    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.donationUpdate).not.toHaveBeenCalled();
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
