import { describe, expect, it, vi } from "vitest";
import { getPublicSponsors } from "@/lib/sponsors/public-sponsors";

function rpcResult(data: unknown, error: Error | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("getPublicSponsors", () => {
  it("loads only the public sponsor aggregate and maps display names with a safe fallback", async () => {
    const supabase = rpcResult([
      {
        public_sponsor_id: "public_user_2",
        display_name: null,
        paid_donation_count: 1,
        paid_total_amount: 500,
        currency: "usd",
        sponsor_level_code: "bronze",
      },
      {
        public_sponsor_id: "public_user_1",
        display_name: "Ada",
        paid_donation_count: 2,
        paid_total_amount: 5500,
        currency: "usd",
        sponsor_level_code: "silver",
      },
    ]);

    await expect(getPublicSponsors(supabase, "Supporter")).resolves.toEqual([
      {
        id: "public_user_2",
        displayName: "Supporter",
        paidDonationCount: 1,
        paidTotalAmount: 500,
        currency: "usd",
        sponsorLevelCode: "bronze",
      },
      {
        id: "public_user_1",
        displayName: "Ada",
        paidDonationCount: 2,
        paidTotalAmount: 5500,
        currency: "usd",
        sponsorLevelCode: "silver",
      },
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith("get_public_sponsors");
  });

  it("throws when the public sponsor query fails", async () => {
    const supabase = rpcResult(null, new Error("blocked"));

    await expect(getPublicSponsors(supabase, "Supporter")).rejects.toThrow("blocked");
  });
});
