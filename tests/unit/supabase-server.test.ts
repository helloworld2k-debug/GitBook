import { describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CookieToSet = {
  name: string;
  value: string;
  options: {
    path?: string;
  };
};

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieToSet[], headers?: Record<string, string>) => void;
};

const cookieStore = vi.hoisted(() => ({
  getAll: vi.fn(() => [] as { name: string; value: string }[]),
  set: vi.fn(),
}));

const omitSetAllHeaders = vi.hoisted(() => ({ value: false }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _anonKey: string, options: { cookies: CookieAdapter }) => ({
    auth: {
      getUser: vi.fn(async () => {
        const headers = omitSetAllHeaders.value
          ? undefined
          : {
            "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          };

        options.cookies.setAll(
          [{ name: "sb-test-auth-token", value: "updated", options: { path: "/" } }],
          headers,
        );

        return { data: { user: { id: "user-1" } } };
      }),
    },
  })),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseBrowserConfig: () => ({
    anonKey: "test-anon-key",
    url: "http://127.0.0.1:54321",
  }),
}));

describe("supabase server client", () => {
  it("writes refreshed auth cookies from server components", async () => {
    omitSetAllHeaders.value = false;
    cookieStore.set.mockReset();

    const supabase = await createSupabaseServerClient();
    await supabase.auth.getUser();

    expect(cookieStore.set).toHaveBeenCalledWith({
      name: "sb-test-auth-token",
      path: "/",
      value: "updated",
    });
  });

  it("does not crash when Supabase omits cache headers", async () => {
    omitSetAllHeaders.value = true;
    cookieStore.set.mockReset();

    const supabase = await createSupabaseServerClient();
    await expect(supabase.auth.getUser()).resolves.toEqual({ data: { user: { id: "user-1" } } });

    expect(cookieStore.set).toHaveBeenCalledWith({
      name: "sb-test-auth-token",
      path: "/",
      value: "updated",
    });
  });
});
