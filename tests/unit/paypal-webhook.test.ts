import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/paypal/route";

const mocks = vi.hoisted(() => ({
  capturePayPalOrder: vi.fn(),
  headers: vi.fn(),
  verifyPayPalWebhook: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/payments/paypal", () => ({
  capturePayPalOrder: mocks.capturePayPalOrder,
  verifyPayPalWebhook: mocks.verifyPayPalWebhook,
}));

describe("PayPal webhook route", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ "paypal-transmission-id": "transmission_123" }));
    mocks.capturePayPalOrder.mockReset();
    mocks.capturePayPalOrder.mockResolvedValue({ id: "CAPTURE-123" });
    mocks.verifyPayPalWebhook.mockReset();
    mocks.verifyPayPalWebhook.mockResolvedValue(true);
  });

  it("rejects invalid PayPal signatures", async () => {
    mocks.verifyPayPalWebhook.mockResolvedValue(false);

    const response = await POST(
      new Request("https://example.com/api/webhooks/paypal", {
        body: JSON.stringify({ event_type: "CHECKOUT.ORDER.APPROVED" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid PayPal webhook signature" });
    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
  });

  it("captures approved orders after validating PayPal metadata", async () => {
    const response = await POST(
      new Request("https://example.com/api/webhooks/paypal", {
        body: JSON.stringify({
          event_type: "CHECKOUT.ORDER.APPROVED",
          resource: {
            custom_id: JSON.stringify({ tierCode: "yearly", userId: "user_123" }),
            id: "ORDER-123",
          },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.capturePayPalOrder).toHaveBeenCalledWith("ORDER-123");
  });

  it("does not recapture completed captures after validating PayPal metadata", async () => {
    const response = await POST(
      new Request("https://example.com/api/webhooks/paypal", {
        body: JSON.stringify({
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            custom_id: JSON.stringify({ tierCode: "monthly", userId: "user_123" }),
            id: "CAPTURE-123",
          },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.capturePayPalOrder).not.toHaveBeenCalled();
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
