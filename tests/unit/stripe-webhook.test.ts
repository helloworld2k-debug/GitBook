import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  headers: vi.fn(),
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

describe("Stripe webhook route", () => {
  beforeEach(() => {
    mocks.constructEvent.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ "stripe-signature": "sig_test" }));
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
});
