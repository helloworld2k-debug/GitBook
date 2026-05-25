import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0053_fix_admin_users_paginated_count_types.sql"),
  "utf8",
);
const accountTypeMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0066_admin_user_account_type.sql"),
  "utf8",
);

describe("admin users paginated RPC count type migration", () => {
  it("returns count columns as bigint instead of text literals", () => {
    expect(migration).toContain("%s::bigint as total_count");
    expect(migration).toContain("%s::bigint as filtered_count");
    expect(migration).not.toContain("%L as total_count");
    expect(migration).not.toContain("%L as filtered_count");
  });

  it("keeps dynamic filters separated so combined search and status filters remain valid SQL", () => {
    expect(migration).toContain("' and p.account_status = %L '");
    expect(migration).toContain("' and p.is_admin = true '");
    expect(migration).toContain("' and p.created_at >= %L '");
  });

  it("adds a durable account type field for standard and AI test users", () => {
    expect(accountTypeMigration).toContain("add column if not exists account_type text not null default 'standard'");
    expect(accountTypeMigration).toContain("check (account_type in ('standard', 'ai_test'))");
  });

  it("backfills only explicit AI regression test accounts", () => {
    expect(accountTypeMigration).toContain("raw_user_meta_data->>'source' = 'codex-online-regression'");
    expect(accountTypeMigration).toContain("auth_users.email ilike 'codex-full-%@example.test'");
    expect(accountTypeMigration).toContain("set account_type = 'ai_test'");
  });

  it("returns and filters account_type from the admin users RPC", () => {
    expect(accountTypeMigration).toContain("'account_type', p.account_type");
    expect(accountTypeMigration).toContain("input_type_filter in ('standard', 'ai_test')");
    expect(accountTypeMigration).toContain("and p.account_type = %L");
  });
});
