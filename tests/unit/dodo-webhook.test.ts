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
  getDodoProductId: async (tierCode: string) =>
    ({
      monthly: process.env.DODO_PRODUCT_MONTHLY,
      quarterly: process.env.DODO_PRODUCT_QUARTERLY,
      yearly: process.env.DODO_PAYMENTS_ENV === "live" ? process.env.DODO_LIVE_PRODUCT_YEARLY : process.env.DODO_PRODUCT_YEARLY,
    })[tierCode] ?? null,
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
    process.env.DODO_PRODUCT_MONTHLY = "pdt_monthly";
    process.env.DODO_PRODUCT_QUARTERLY = "pdt_quarterly";
    process.env.DODO_PRODUCT_YEARLY = "pdt_yearly";
    process.env.DODO_LIVE_PRODUCT_YEARLY = "pdt_live_yearly";
    process.env.DODO_PAYMENTS_ENV = "test";
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

    expect(response.status).toBe(401);
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
        product_cart: [{ product_id: "pdt_yearly" }],
        status: "succeeded",
        total_amount: 8640,
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8640,
        currency: "usd",
        metadata: expect.objectContaining({ tier: "yearly" }),
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

  it("verifies live product ids when webhook processing runs in live mode", async () => {
    process.env.DODO_PAYMENTS_ENV = "live";
    mocks.verifyDodoWebhook.mockReturnValue({
      type: "payment.succeeded",
      data: {
        currency: "USD",
        created_at: "2026-04-29T00:00:00.000Z",
        metadata: {
          amount: "8640",
          tier: "yearly",
          user_id: "user_123",
        },
        payment_id: "pay_live",
        product_cart: [{ product_id: "pdt_yearly" }],
        status: "succeeded",
        total_amount: 8640,
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects mismatched amount even when the product id verifies the selected tier", async () => {
    mocks.verifyDodoWebhook.mockReturnValue({
      type: "payment.succeeded",
      data: {
        currency: "USD",
        created_at: "2026-04-29T00:00:00.000Z",
        metadata: {
          amount: "8640",
          tier: "yearly",
          user_id: "user_123",
        },
        payment_id: "pay_456",
        product_cart: [{ product_id: "pdt_yearly" }],
        status: "succeeded",
        total_amount: 1200,
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.generateCertificatesForDonation).not.toHaveBeenCalled();
  });

  it("accepts provider-local currency totals when product id and selected tier match", async () => {
    mocks.verifyDodoWebhook.mockReturnValue({
      type: "payment.succeeded",
      data: {
        currency: "CNY",
        created_at: "2026-04-29T00:00:00.000Z",
        metadata: {
          amount: "2475",
          tier: "quarterly",
          user_id: "user_123",
        },
        payment_id: "pay_cny",
        product_cart: [{ product_id: "pdt_quarterly" }],
        status: "succeeded",
        total_amount: 17527,
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 17527,
        currency: "cny",
        metadata: expect.objectContaining({
          expected_amount: 2475,
          paid_amount: 17527,
          tier: "quarterly",
        }),
        provider: "dodo",
        provider_transaction_id: "pay_cny",
        user_id: "user_123",
      }),
      { onConflict: "provider,provider_transaction_id" },
    );
    expect(mocks.extendCloudSyncEntitlementForDonation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        donationId: "donation_123",
        tierCode: "quarterly",
        userId: "user_123",
      }),
    );
  });

  it("returns an error when a paid donation is saved but entitlement extension fails", async () => {
    mocks.verifyDodoWebhook.mockReturnValue({
      type: "payment.succeeded",
      data: {
        currency: "USD",
        created_at: "2026-04-29T00:00:00.000Z",
        metadata: {
          amount: "8640",
          tier: "yearly",
          user_id: "user_123",
        },
        payment_id: "pay_789",
        product_cart: [{ product_id: "pdt_yearly" }],
        status: "succeeded",
        total_amount: 8640,
      },
    });
    mocks.extendCloudSyncEntitlementForDonation.mockRejectedValue(new Error("rpc failed"));

    const response = await POST(new Request("https://example.com/api/webhooks/dodo", { body: "{}", method: "POST" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to extend entitlement" });
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
