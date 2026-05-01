import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0008_account_first_trials_admin_roles.sql"),
  "utf8",
);

describe("account-first trial and admin roles migration", () => {
  it("adds owner/operator roles and account status to profiles", () => {
    expect(migration).toContain("add column if not exists admin_role text not null default 'user'");
    expect(migration).toContain("check (admin_role in ('owner', 'operator', 'user'))");
    expect(migration).toContain("add column if not exists account_status text not null default 'active'");
    expect(migration).toContain("check (account_status in ('active', 'disabled'))");
    expect(migration).toContain("set admin_role = 'owner'");
  });

  it("makes trial redemptions account-first and bindable later", () => {
    expect(migration).toContain("alter column machine_code_hash drop not null");
    expect(migration).toContain("add column if not exists bound_at timestamptz");
    expect(migration).toContain("add column if not exists desktop_session_id uuid references public.desktop_sessions");
    expect(migration).toContain("add column if not exists device_id text");
  });

  it("redeems trial codes without requiring a machine hash", () => {
    expect(migration).toContain("create or replace function public.redeem_trial_code(");
    expect(migration).toContain("input_user_id uuid");
    expect(migration).toContain("input_code_hash text");
    expect(migration).toContain("input_now timestamptz");
    expect(migration).not.toContain("input_machine_code_hash text,\n  input_now timestamptz");
    expect(migration).toContain("machine_code_hash,\n    feature_code");
    expect(migration).toContain("null,\n    'cloud_sync'");
    expect(migration).toContain("grant execute on function public.redeem_trial_code(uuid, text, timestamptz) to service_role");
  });

  it("binds the first active unbound account trial during desktop auth exchange", () => {
    expect(migration).toContain("where user_id = auth_user_id");
    expect(migration).toContain("and trial_valid_until > input_now");
    expect(migration).toContain("and machine_code_hash is null");
    expect(migration).toContain("from public.machine_trial_claims");
    expect(migration).toContain("where machine_code_hash = input_machine_code_hash");
    expect(migration).toContain("insert into public.machine_trial_claims");
    expect(migration).toContain("set machine_code_hash = input_machine_code_hash");
    expect(migration).toContain("bound_at = input_now");
  });
});
