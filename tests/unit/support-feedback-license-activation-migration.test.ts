import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0010_support_threads_license_activation.sql"),
  "utf8",
);

describe("support threads and license activation migration", () => {
  it("adds threaded feedback replies with user ownership policies", () => {
    expect(migration).toContain("create table if not exists public.support_feedback_messages");
    expect(migration).toContain("author_role text not null");
    expect(migration).toContain("support_feedback_messages_own_insert");
    expect(migration).toContain("support_feedback_messages_admin_all");
  });

  it("makes generated license codes activate from redemption time instead of admin-entered windows", () => {
    expect(migration).toContain("alter column starts_at drop not null");
    expect(migration).toContain("alter column ends_at drop not null");
    expect(migration).toContain("create or replace function public.redeem_trial_code");
    expect(migration).not.toContain("input_now < trial.starts_at");
    expect(migration).not.toContain("input_now > trial.ends_at");
    expect(migration).toContain("trial.deleted_at is not null");
    expect(migration).toContain("trial_valid_until := input_now + make_interval(days => trial.trial_days)");
  });
});
