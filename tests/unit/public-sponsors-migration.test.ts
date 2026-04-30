import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0003_public_sponsors.sql"), "utf8");

describe("public sponsors migration", () => {
  it("exposes only opted-in paid supporter aggregate fields", () => {
    expect(migration).toContain("profiles.public_supporter_enabled = true");
    expect(migration).toContain("donations.status = 'paid'");
    expect(migration).toContain("md5(paid_supporters.id::text) as public_sponsor_id");
    expect(migration).not.toMatch(/\bemail\b/i);
  });

  it("grants public execute access only to the aggregate function", () => {
    expect(migration).toContain("revoke execute on function public.get_public_sponsors() from public");
    expect(migration).toContain("grant execute on function public.get_public_sponsors() to anon, authenticated");
  });
});
