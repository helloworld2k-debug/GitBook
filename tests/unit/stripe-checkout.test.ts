import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checkout/stripe/route";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/payments/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mocks.createCheckoutSession,
      },
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

describe("Stripe checkout route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user_123" } } });
  });

  it("uses the canonical site URL for Stripe redirects instead of the request Origin", async () => {
    const formData = new FormData();
    formData.set("tier", "yearly");

    await POST(
      new Request("https://gitbookai.example/api/checkout/stripe", {
        body: formData,
        headers: {
          Origin: "https://evil.example",
        },
        method: "POST",
      }),
    );

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: "https://gitbookai.example/en/contributions?payment=cancelled",
        success_url: "https://gitbookai.example/en/dashboard/certificates/latest?payment=stripe-success",
      }),
    );
  });

  it("redirects anonymous checkout attempts to the localized donate page after login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const formData = new FormData();
    formData.set("tier", "monthly");
    formData.set("locale", "zh-Hant");

    const response = await POST(
      new Request("https://gitbookai.example/api/checkout/stripe", {
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
});
