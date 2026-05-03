import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checkout/dodo/route";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/payments/dodo", () => ({
  createDodoCheckoutSession: mocks.createCheckoutSession,
  getDodoProductId: (tierCode: string) =>
    ({
      monthly: process.env.DODO_PRODUCT_MONTHLY,
      quarterly: process.env.DODO_PRODUCT_QUARTERLY,
      yearly: process.env.DODO_PRODUCT_YEARLY,
    })[tierCode] ?? null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

describe("Dodo checkout route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
    process.env.DODO_PRODUCT_MONTHLY = "pdt_monthly";
    process.env.DODO_PRODUCT_QUARTERLY = "pdt_quarterly";
    process.env.DODO_PRODUCT_YEARLY = "pdt_yearly";
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({ checkout_url: "https://checkout.dodopayments.test/session" });
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user_123", email: "ada@example.com" } } });
  });

  it("creates a Dodo checkout session for the selected support tier", async () => {
    const formData = new FormData();
    formData.set("tier", "yearly");
    formData.set("locale", "ja");

    const response = await POST(
      new Request("https://gitbookai.example/api/checkout/dodo", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.dodopayments.test/session");
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      cancel_url: "https://gitbookai.example/ja/donate?payment=cancelled",
      customer: {
        email: "ada@example.com",
      },
      feature_flags: {
        redirect_immediately: true,
      },
      metadata: {
        amount: "5000",
        currency: "usd",
        tier: "yearly",
        user_id: "user_123",
      },
      payment_link: true,
      product_cart: [
        {
          product_id: "pdt_yearly",
          quantity: 1,
        },
      ],
      return_url: "https://gitbookai.example/ja/dashboard/certificates/latest?payment=dodo-success",
    });
  });

  it("redirects anonymous checkout attempts to the localized donate page after login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const formData = new FormData();
    formData.set("tier", "monthly");
    formData.set("locale", "zh-Hant");

    const response = await POST(
      new Request("https://gitbookai.example/api/checkout/dodo", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://gitbookai.example/zh-Hant/login?next=%2Fzh-Hant%2Fdonate",
    );
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });
});
