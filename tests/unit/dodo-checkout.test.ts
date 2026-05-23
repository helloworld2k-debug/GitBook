import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checkout/dodo/route";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getPaymentCheckoutStatus: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  validateRequestOrigin: () => true,
}));

vi.mock("@/lib/payments/dodo", () => ({
  createDodoCheckoutSession: mocks.createCheckoutSession,
  getDodoProductId: async (tierCode: string) =>
    ({
      one_day: process.env.DODO_PAYMENTS_ENV === "live" ? process.env.DODO_LIVE_PRODUCT_ONE_DAY : process.env.DODO_PRODUCT_ONE_DAY,
      monthly: process.env.DODO_PRODUCT_MONTHLY,
      quarterly: process.env.DODO_PRODUCT_QUARTERLY,
      yearly: process.env.DODO_PAYMENTS_ENV === "live" ? process.env.DODO_LIVE_PRODUCT_YEARLY : process.env.DODO_PRODUCT_YEARLY,
    })[tierCode] ?? null,
}));

vi.mock("@/lib/payments/maintenance", () => ({
  getPaymentCheckoutStatus: mocks.getPaymentCheckoutStatus,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

describe("Dodo checkout route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
    process.env.DODO_PAYMENTS_ENV = "test";
    process.env.DODO_PRODUCT_ONE_DAY = "pdt_one_day";
    process.env.DODO_PRODUCT_MONTHLY = "pdt_monthly";
    process.env.DODO_PRODUCT_QUARTERLY = "pdt_quarterly";
    process.env.DODO_PRODUCT_YEARLY = "pdt_yearly";
    process.env.DODO_LIVE_PRODUCT_ONE_DAY = "pdt_live_one_day";
    process.env.DODO_LIVE_PRODUCT_YEARLY = "pdt_live_yearly";
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({ checkout_url: "https://checkout.dodopayments.test/session" });
    mocks.getPaymentCheckoutStatus.mockReset();
    mocks.getPaymentCheckoutStatus.mockResolvedValue({ isPaused: false, message: null });
    const order = vi.fn(async () => ({
      data: [
        {
          amount: 8640,
          code: "yearly",
          compare_at_amount: 10800,
          currency: "usd",
          description: "Yearly support",
          id: "tier-yearly",
          label: "Yearly Support",
          sort_order: 3,
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReset().mockReturnValue({ select });
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
      cancel_url: expect.stringMatching(/^https:\/\/gitbookai\.example\/ja\/contributions\?payment=cancelled&checkout_started_at=/),
      customer: {
        email: "ada@example.com",
      },
      feature_flags: {
        redirect_immediately: true,
      },
      metadata: {
        amount: "8640",
        compare_at_amount: "10800",
        currency: "usd",
        donation_tier_id: "tier-yearly",
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
      return_url: expect.stringMatching(/^https:\/\/gitbookai\.example\/ja\/dashboard\/certificates\/latest\?payment=dodo-success&checkout_started_at=/),
    });
  });

  it("uses the live Dodo product id when checkout runs in live mode", async () => {
    process.env.DODO_PAYMENTS_ENV = "live";
    const order = vi.fn(async () => ({
      data: [
        {
          amount: 100,
          code: "one_day",
          compare_at_amount: null,
          currency: "usd",
          description: "1-day support",
          id: "tier-one-day",
          label: "1-Day Support",
          sort_order: 0,
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValueOnce({ select });
    const formData = new FormData();
    formData.set("tier", "one_day");
    formData.set("locale", "en");

    const response = await POST(
      new Request("https://gitbookai.example/api/checkout/dodo", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [
          {
            product_id: "pdt_live_one_day",
            quantity: 1,
          },
        ],
        metadata: expect.objectContaining({
          amount: "100",
          donation_tier_id: "tier-one-day",
          tier: "one_day",
        }),
      }),
    );
  });

  it("redirects anonymous checkout attempts to the localized contributions page after login", async () => {
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
      "https://gitbookai.example/zh-Hant/login?next=%2Fzh-Hant%2Fcontributions",
    );
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects new checkout sessions while payments are paused", async () => {
    mocks.getPaymentCheckoutStatus.mockResolvedValueOnce({
      isPaused: true,
      message: "Checkout is temporarily paused.",
    });
    const formData = new FormData();
    formData.set("tier", "yearly");
    formData.set("locale", "en");

    const response = await POST(
      new Request("https://gitbookai.example/api/checkout/dodo", {
        body: formData,
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "Checkout is temporarily paused." });
    expect(response.status).toBe(503);
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });
});
