import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  constructEvent: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
  headers: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/payments/stripe", () => ({
  getStripeWebhookSecret: () => "whsec_test",
  stripe: {
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/certificates/service", () => ({
  generateCertificatesForDonation: mocks.generateCertificatesForDonation,
}));

describe("Stripe webhook route", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset();
    mocks.constructEvent.mockReset();
    mocks.generateCertificatesForDonation.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ "stripe-signature": "sig_test" }));
    mocks.single.mockReset();
    mocks.single.mockResolvedValue({ data: { id: "donation_123" }, error: null });
    mocks.upsert.mockReset();
    mocks.upsert.mockReturnValue({ select: vi.fn(() => ({ single: mocks.single })) });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        upsert: mocks.upsert,
      })),
    });
  });

  it("rejects checkout sessions with unknown tier metadata", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            tier: "lifetime",
            user_id: "user_123",
          },
          payment_intent: "pi_123",
        },
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/stripe", { body: "{}", method: "POST" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing required metadata" });
  });

  it("upserts a completed checkout donation and generates certificates", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          created: 1777420800,
          metadata: {
            tier: "yearly",
            user_id: "user_123",
          },
          payment_intent: "pi_123",
        },
      },
    });

    const response = await POST(new Request("https://example.com/api/webhooks/stripe", { body: "{}", method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: "usd",
        metadata: { tier: "yearly" },
        paid_at: "2026-04-29T00:00:00.000Z",
        provider: "stripe",
        provider_transaction_id: "pi_123",
        status: "paid",
        user_id: "user_123",
      }),
      { onConflict: "provider,provider_transaction_id" },
    );
    expect(mocks.generateCertificatesForDonation).toHaveBeenCalledWith("donation_123");
  });
});
