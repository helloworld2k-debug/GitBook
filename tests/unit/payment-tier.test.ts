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
});
