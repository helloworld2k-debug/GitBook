import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0009_admin_user_soft_delete.sql"),
  "utf8",
);

describe("admin user soft delete migration", () => {
  it("extends profile account status to include deleted", () => {
    expect(migration).toContain("drop constraint if exists profiles_account_status_check");
    expect(migration).toContain("check (account_status in ('active', 'disabled', 'deleted'))");
  });

  it("keeps admin checks restricted to active accounts", () => {
    expect(migration).toContain("and account_status = 'active'");
  });

  it("blocks deleted desktop auth profiles alongside disabled ones", () => {
    expect(migration).toContain("and account_status in ('disabled', 'deleted')");
  });
});
