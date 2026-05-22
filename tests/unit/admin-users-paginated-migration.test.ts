import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0053_fix_admin_users_paginated_count_types.sql"),
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
});
