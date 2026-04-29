import { describe, expect, it } from "vitest";
import { findDonationTier } from "@/lib/payments/tier";

describe("findDonationTier", () => {
  it("returns a tier by code", () => {
    expect(findDonationTier("yearly")?.amount).toBe(5000);
  });

  it("returns null for invalid tier codes", () => {
    expect(findDonationTier("lifetime")).toBeNull();
  });
});
