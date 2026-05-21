import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0038_confirmation_resend_attempts_cleanup.sql"), "utf8");

describe("confirmation resend attempts cleanup migration", () => {
  it("creates a cleanup function with a configurable retention period", () => {
    expect(migration).toContain("create or replace function public.cleanup_confirmation_resend_attempts");
    expect(migration).toContain("input_retention_days integer default 7");
  });

  it("deletes records older than the retention window", () => {
    expect(migration).toContain("delete from public.confirmation_resend_attempts");
    expect(migration).toContain("created_at < now() - make_interval(days => input_retention_days)");
  });

  it("restricts execution to service_role only", () => {
    expect(migration).toContain("revoke execute on function public.cleanup_confirmation_resend_attempts(integer) from public");
    expect(migration).toContain("grant execute on function public.cleanup_confirmation_resend_attempts(integer) to service_role");
  });
});
