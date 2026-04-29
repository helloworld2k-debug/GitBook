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
    process.env.NEXT_PUBLIC_SITE_URL = "https://threefriends.example";
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user_123" } } });
  });

  it("uses the canonical site URL for Stripe redirects instead of the request Origin", async () => {
    const formData = new FormData();
    formData.set("tier", "yearly");

    await POST(
      new Request("https://threefriends.example/api/checkout/stripe", {
        body: formData,
        headers: {
          Origin: "https://evil.example",
        },
        method: "POST",
      }),
    );

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: "https://threefriends.example/en/donate?payment=cancelled",
        success_url: "https://threefriends.example/en/dashboard?payment=stripe-success",
      }),
    );
  });
});
