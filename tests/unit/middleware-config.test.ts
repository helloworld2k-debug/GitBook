import { describe, expect, it, vi } from "vitest";
import { config } from "@/middleware";

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock("next-intl/navigation", () => ({
  createNavigation: vi.fn(() => ({
    Link: "a",
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  refreshSupabaseSession: vi.fn(async (_request, response) => response),
}));

describe("middleware config", () => {
  it("does not locale-redirect the auth callback route", () => {
    const matcher = config.matcher[0];
    const authCallbackPath = "/auth/callback";

    expect(new RegExp(`^${matcher}$`).test(authCallbackPath)).toBe(false);
  });
});
