import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWithEmailPassword } from "@/lib/auth/register";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseBrowserConfig: () => ({
    anonKey: "anon-key",
    url: "https://supabase.example",
  }),
}));

describe("registerWithEmailPassword", () => {
  beforeEach(() => {
    mocks.createBrowserClient.mockReset().mockReturnValue({
      auth: {
        signUp: mocks.signUp,
      },
    });
    mocks.signUp.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  });

  it("requests Supabase email verification with the website callback URL", async () => {
    await registerWithEmailPassword({
      callbackUrl: "https://gitbookai.ccwu.cc/auth/callback?next=%2Fen%2Fcontributions",
      email: "new@example.com",
      password: "new-password",
    });

    expect(mocks.createBrowserClient).toHaveBeenCalledWith(
      "https://supabase.example",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "new-password",
      options: {
        data: {
          source: "register_form",
        },
        emailRedirectTo: "https://gitbookai.ccwu.cc/auth/callback?next=%2Fen%2Fcontributions",
      },
    });
  });
});
