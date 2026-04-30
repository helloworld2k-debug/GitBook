import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0005_admin_audit_rpcs.sql"), "utf8");

describe("admin audit RPC migration", () => {
  it("creates manual donations and audit rows in the same database function", () => {
    expect(migration).toContain("create or replace function public.create_manual_paid_donation_with_audit");
    expect(migration).toContain("insert into public.donations");
    expect(migration).toContain("insert into public.admin_audit_logs");
    expect(migration).toContain("return inserted_donation.id");
  });

  it("keeps manual donation creation idempotent through the provider transaction constraint", () => {
    expect(migration).toContain("input_provider_transaction_id");
    expect(migration).toContain("when unique_violation");
    expect(migration).toContain("return inserted_donation.id");
    expect(migration).toContain("metadata->>'reason' = btrim(input_reason)");
    expect(migration).toContain("metadata->>'admin_user_id' = input_admin_user_id::text");
    expect(migration).toContain("Manual donation reference already exists");
  });

  it("revokes only active certificates and preserves certificate numbers", () => {
    expect(migration).toContain("where id = input_certificate_id");
    expect(migration).toContain("and status = 'active'");
    expect(migration).toContain("status = 'revoked'");
    expect(migration).toContain("revoked_at = now()");
    expect(migration).not.toContain("certificate_number =");
  });

  it("limits execution to the service role", () => {
    expect(migration).toContain("revoke execute on function public.create_manual_paid_donation_with_audit");
    expect(migration).toContain("revoke execute on function public.revoke_certificate_with_audit");
    expect(migration).toContain("grant execute on function public.create_manual_paid_donation_with_audit");
    expect(migration).toContain("grant execute on function public.revoke_certificate_with_audit");
    expect(migration).toContain("to service_role");
  });
});
