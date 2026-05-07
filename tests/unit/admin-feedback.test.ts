import { describe, expect, it } from "vitest";
import { sanitizeAdminReturnTo } from "@/lib/admin/feedback";

describe("sanitizeAdminReturnTo", () => {
  it("keeps safe admin paths under the action locale", () => {
    expect(sanitizeAdminReturnTo("ja", "/admin/users", "/admin")).toBe("/ja/admin/users");
  });

  it("falls back to English and the fallback admin path for unsafe input", () => {
    expect(sanitizeAdminReturnTo("not-a-locale", "https://evil.example/admin", "/admin/users")).toBe(
      "/en/admin/users",
    );
    expect(sanitizeAdminReturnTo("fr", "/_next/static/chunk.js", "/not-admin")).toBe("/en/admin");
  });
});
