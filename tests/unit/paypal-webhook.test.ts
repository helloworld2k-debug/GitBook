import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/paypal/route";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  verifyPayPalWebhook: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/payments/paypal", () => ({
  verifyPayPalWebhook: mocks.verifyPayPalWebhook,
}));

describe("PayPal webhook route", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ "paypal-transmission-id": "transmission_123" }));
    mocks.verifyPayPalWebhook.mockReset();
    mocks.verifyPayPalWebhook.mockResolvedValue(true);
  });

  it("rejects approved orders with invalid custom_id JSON", async () => {
    const response = await POST(
      new Request("https://example.com/api/webhooks/paypal", {
        body: JSON.stringify({
          event_type: "CHECKOUT.ORDER.APPROVED",
          resource: {
            custom_id: "{bad json",
            id: "ORDER-123",
          },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing required metadata" });
  });

  it("rejects completed captures with unknown tier metadata", async () => {
    const response = await POST(
      new Request("https://example.com/api/webhooks/paypal", {
        body: JSON.stringify({
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            custom_id: JSON.stringify({ tierCode: "lifetime", userId: "user_123" }),
            id: "CAPTURE-123",
          },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing required metadata" });
  });
});
