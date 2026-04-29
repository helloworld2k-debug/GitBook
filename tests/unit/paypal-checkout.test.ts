import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checkout/paypal/route";

const mocks = vi.hoisted(() => ({
  createPayPalOrder: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/payments/paypal", () => ({
  createPayPalOrder: mocks.createPayPalOrder,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

describe("PayPal checkout route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    mocks.createPayPalOrder.mockReset();
    mocks.createPayPalOrder.mockResolvedValue({
      id: "ORDER-123",
      links: [{ href: "https://paypal.test/approve", rel: "approve" }],
    });
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user_123" } } });
  });

  it("uses the canonical site URL for PayPal redirects instead of the request Origin", async () => {
    const formData = new FormData();
    formData.set("tier", "yearly");

    const response = await POST(
      new Request("https://threefriends.example/api/checkout/paypal", {
        body: formData,
        headers: {
          Origin: "https://evil.example",
        },
        method: "POST",
      }),
    );

    expect(mocks.createPayPalOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "50.00",
        cancelUrl: "https://threefriends.example/en/donate?payment=cancelled",
        currency: "USD",
        returnUrl: "https://threefriends.example/en/dashboard?payment=paypal-success",
        tierCode: "yearly",
        userId: "user_123",
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://paypal.test/approve");
  });
});
