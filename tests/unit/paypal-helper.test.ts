import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturePayPalOrder } from "@/lib/payments/paypal";

describe("PayPal payment helper", () => {
  beforeEach(() => {
    process.env.PAYPAL_BASE_URL = "https://paypal.test";
    process.env.PAYPAL_CLIENT_ID = "client_test";
    process.env.PAYPAL_CLIENT_SECRET = "secret_test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAYPAL_BASE_URL;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  it("sends a deterministic PayPal request id when capturing an order", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "access_test" }))
      .mockResolvedValueOnce(Response.json({ id: "CAPTURE-123" }));
    vi.stubGlobal("fetch", fetchMock);

    await capturePayPalOrder("ORDER-123");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://paypal.test/v2/checkout/orders/ORDER-123/capture",
      expect.objectContaining({
        headers: expect.objectContaining({
          "PayPal-Request-Id": "gitbook-ai-capture-ORDER-123",
        }),
        method: "POST",
      }),
    );
  });
});
