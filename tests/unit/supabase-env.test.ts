import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseBrowserConfig } from "@/lib/supabase/env";

const originalEnv = process.env;

describe("supabase env", () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns public Supabase browser config when both values are configured", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };

    expect(getSupabaseBrowserConfig()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("throws a descriptive error when public Supabase config is incomplete", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };

    expect(() => getSupabaseBrowserConfig()).toThrow(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Set it to your Supabase project URL.",
    );
  });
});
