import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0067_desktop_auth_active_profile_guard.sql"),
  "utf8",
);

describe("desktop auth active profile guard migration", () => {
  it("requires active profiles before exchanging desktop auth codes", () => {
    expect(migration).toContain("create or replace function public.exchange_desktop_auth_code");
    expect(migration).toContain("from public.profiles as p");
    expect(migration).toContain("p.id = claimed_user_id");
    expect(migration).toContain("p.account_status = 'active'");
    expect(migration).toContain("if not active_profile_exists then");
    expect(migration).toContain("return;");
    expect(migration).toContain("insert into public.desktop_sessions");
  });
});
