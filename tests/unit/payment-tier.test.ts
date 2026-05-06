import { describe, expect, it, vi } from "vitest";
import { findDonationTier, getActiveDonationTiers } from "@/lib/payments/tier";

describe("findDonationTier", () => {
  it("returns a tier by code", () => {
    expect(findDonationTier("yearly")?.amount).toBe(8640);
  });

  it("returns null for invalid tier codes", () => {
    expect(findDonationTier("lifetime")).toBeNull();
  });
});

describe("getActiveDonationTiers", () => {
  it("reads active tiers from the database in sort order", async () => {
    const order = vi.fn(async () => ({
      data: [
        {
          amount: 900,
          code: "monthly",
          compare_at_amount: null,
          currency: "usd",
          description: "Monthly support",
          id: "tier-monthly",
          label: "Monthly Support",
          sort_order: 1,
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    await expect(getActiveDonationTiers(client)).resolves.toEqual([
      {
        amount: 900,
        code: "monthly",
        compareAtAmount: null,
        currency: "usd",
        description: "Monthly support",
        id: "tier-monthly",
        label: "Monthly Support",
        labelKey: "donate.tiers.monthly",
        sortOrder: 1,
      },
    ]);
    expect(client.from).toHaveBeenCalledWith("donation_tiers");
    expect(select).toHaveBeenCalledWith("id,code,label,description,amount,compare_at_amount,currency,sort_order");
    expect(eq).toHaveBeenCalledWith("is_active", true);
    expect(order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("falls back to the legacy tier column set when original price has not been migrated yet", async () => {
    const newOrder = vi.fn(async () => ({
      data: null,
      error: { code: "42703", message: "column donation_tiers.compare_at_amount does not exist" },
    }));
    const legacyOrder = vi.fn(async () => ({
      data: [
        {
          amount: 2430,
          code: "quarterly",
          currency: "usd",
          description: "Quarterly support",
          id: "tier-quarterly",
          label: "Quarterly Support",
          sort_order: 2,
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order: newOrder }));
    const legacyEq = vi.fn(() => ({ order: legacyOrder }));
    const select = vi
      .fn()
      .mockReturnValueOnce({ eq })
      .mockReturnValueOnce({ eq: legacyEq });
    const client = { from: vi.fn(() => ({ select })) };

    await expect(getActiveDonationTiers(client)).resolves.toEqual([
      expect.objectContaining({
        amount: 2430,
        code: "quarterly",
        compareAtAmount: 2700,
        id: "tier-quarterly",
      }),
    ]);
    expect(select).toHaveBeenNthCalledWith(2, "id,code,label,description,amount,currency,sort_order");
  });

  it("returns configured tiers when the database query fails", async () => {
    const order = vi.fn(async () => ({
      data: null,
      error: { message: "relation donation_tiers is unavailable" },
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    await expect(getActiveDonationTiers(client)).resolves.toEqual([
      expect.objectContaining({ amount: 900, code: "monthly", compareAtAmount: null }),
      expect.objectContaining({ amount: 2430, code: "quarterly", compareAtAmount: 2700 }),
      expect.objectContaining({ amount: 8640, code: "yearly", compareAtAmount: 10800 }),
    ]);
  });
});
