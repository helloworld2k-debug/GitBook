import { NextResponse, type NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

type CookieToSet = {
  name: string;
  value: string;
  options: {
    path?: string;
  };
};

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void;
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _anonKey: string, options: { cookies: CookieAdapter }) => {
    return {
      auth: {
        getUser: vi.fn(async () => {
          options.cookies.setAll(
            [{ name: "sb-test-auth-token", value: "updated", options: { path: "/" } }],
            {
              "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
              Expires: "0",
              Pragma: "no-cache",
            },
          );

          return { data: { user: null } };
        }),
      },
    };
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseBrowserConfig: () => ({
    anonKey: "test-anon-key",
    url: "http://127.0.0.1:54321",
  }),
}));

describe("supabase middleware", () => {
  it("forwards auth cookie cache headers onto the response", async () => {
    const request = {
      cookies: {
        getAll: vi.fn(() => []),
        set: vi.fn(),
      },
    } as unknown as NextRequest;
    const response = NextResponse.next();

    const refreshedResponse = await refreshSupabaseSession(request, response);

    expect(refreshedResponse).toBe(response);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("updated");
    expect(request.cookies.set).toHaveBeenCalledWith("sb-test-auth-token", "updated");
  });
});
