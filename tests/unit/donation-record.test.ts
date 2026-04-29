import { describe, expect, it } from "vitest";
import { buildDonationRecord } from "@/lib/donations/record";

describe("buildDonationRecord", () => {
  it("creates a paid donation record from provider data", () => {
    expect(
      buildDonationRecord({
        userId: "user_123",
        tierCode: "monthly",
        amount: 500,
        currency: "usd",
        provider: "stripe",
        providerTransactionId: "pi_123",
      }),
    ).toMatchObject({
      user_id: "user_123",
      amount: 500,
      currency: "usd",
      provider: "stripe",
      provider_transaction_id: "pi_123",
      status: "paid",
      metadata: { tier: "monthly" },
    });
  });
});
