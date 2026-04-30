import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import middleware from "@/middleware";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

const originalEnv = process.env;

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => vi.fn(() => NextResponse.next())),
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

describe("middleware Supabase environment handling", () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("keeps public pages reachable before Supabase environment variables are configured", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
    };

    const response = await middleware(new NextRequest("https://threefriends.example/en"));

    expect(response).toBeInstanceOf(NextResponse);
    expect(refreshSupabaseSession).not.toHaveBeenCalled();
  });
});
