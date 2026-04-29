import { describe, expect, it } from "vitest";
import { getLoginRedirectPath, isAdminProfile } from "@/lib/auth/guards";

describe("auth guards", () => {
  it("builds locale-aware login redirects", () => {
    expect(getLoginRedirectPath("ja", "/ja/donate?tier=yearly")).toBe(
      "/ja/login?next=%2Fja%2Fdonate%3Ftier%3Dyearly",
    );
  });

  it("recognizes admin profiles", () => {
    expect(isAdminProfile({ is_admin: true })).toBe(true);
    expect(isAdminProfile({ is_admin: false })).toBe(false);
    expect(isAdminProfile(null)).toBe(false);
  });
});
