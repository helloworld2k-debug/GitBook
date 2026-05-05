import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";

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

describe("proxy config", () => {
  it("uses the Next.js proxy convention instead of deprecated middleware", () => {
    expect(existsSync("src/proxy.ts")).toBe(true);
    expect(existsSync("src/middleware.ts")).toBe(false);
  });

  it("does not locale-redirect the auth callback route", () => {
    const matcher = config.matcher[0];
    const authCallbackPath = "/auth/callback";

    expect(new RegExp(`^${matcher}$`).test(authCallbackPath)).toBe(false);
  });
});
