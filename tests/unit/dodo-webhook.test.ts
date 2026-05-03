import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/dodo/route";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  extendCloudSyncEntitlementForDonation: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
  verifyDodoWebhook: vi.fn(),
}));

vi.mock("@/lib/payments/dodo", () => ({
  verifyDodoWebhook: mocks.verifyDodoWebhook,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/certificates/service", () => ({
  generateCertificatesForDonation: mocks.generateCertificatesForDonation,
}));

vi.mock("@/lib/license/entitlements", () => ({
  extendCloudSyncEntitlementForDonation: mocks.extendCloudSyncEntitlementForDonation,
}));

describe("Dodo webhook route", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset();
    mocks.extendCloudSyncEntitlementForDonation.mockReset().mockResolvedValue("2027-04-29T00:00:00.000Z");
    mocks.generateCertificatesForDonation.mockReset();
    mocks.single.mockReset();
    mocks.single.mockResolvedValue({ data: { id: "donation_123" }, error: null });
    mocks.upsert.mockReset();
    mocks.upsert.mockReturnValue({ select: vi.fn(() => ({ single: mocks.single })) });
    mocks.verifyDodoWebhook.mockReset();
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        upsert: mocks.upsert,
      })),
    });
  });

  it("rejects invalid webhook signatures", async () => {
    mocks.verifyDodoWebhook.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid Dodo signature" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("records successful Dodo payments and generates certificates", async () => {
    mocks.verifyDodoWebhook.mockReturnValue({
      type: "payment.succeeded",
      data: {
        currency: "USD",
        created_at: "2026-04-29T00:00:00.000Z",
        metadata: {
          tier: "yearly",
          user_id: "user_123",
        },
        payment_id: "pay_123",
        status: "succeeded",
        total_amount: 5000,
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: "usd",
        metadata: { tier: "yearly" },
        paid_at: "2026-04-29T00:00:00.000Z",
        provider: "dodo",
        provider_transaction_id: "pay_123",
        status: "paid",
        user_id: "user_123",
      }),
      { onConflict: "provider,provider_transaction_id" },
    );
    expect(mocks.generateCertificatesForDonation).toHaveBeenCalledWith("donation_123");
    expect(mocks.extendCloudSyncEntitlementForDonation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: "user_123",
        donationId: "donation_123",
        tierCode: "yearly",
        paidAt: new Date("2026-04-29T00:00:00.000Z"),
      },
    );
  });
});
