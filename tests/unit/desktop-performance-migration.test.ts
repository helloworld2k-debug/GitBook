import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0027_desktop_api_performance_indexes.sql"),
  "utf8",
);

describe("desktop API performance migration", () => {
  it("adds indexes for high-frequency desktop auth and entitlement reads", () => {
    expect(migration).toContain("desktop_sessions_token_active_idx");
    expect(migration).toContain("on public.desktop_sessions (token_hash)");
    expect(migration).toContain("where revoked_at is null");
    expect(migration).toContain("license_entitlements_user_feature_status_idx");
    expect(migration).toContain("on public.license_entitlements (user_id, feature_code, status)");
    expect(migration).toContain("machine_trial_claims_user_machine_feature_idx");
    expect(migration).toContain("on public.machine_trial_claims (user_id, machine_code_hash, feature_code)");
  });

  it("adds cloud sync lease indexes for active and cooldown checks", () => {
    expect(migration).toContain("cloud_sync_leases_active_user_machine_idx");
    expect(migration).toContain("on public.cloud_sync_leases (user_id, machine_code_hash, created_at desc)");
    expect(migration).toContain("where revoked_at is null");
    expect(migration).toContain("cloud_sync_leases_cooldown_user_machine_idx");
    expect(migration).toContain("on public.cloud_sync_leases (user_id, machine_code_hash, cooldown_until desc)");
    expect(migration).toContain("where revoked_at is not null and cooldown_until is not null");
  });
});
