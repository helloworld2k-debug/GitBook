import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0032_cloud_sync_force_switch_overrides.sql"),
  "utf8",
);

describe("cloud sync force-switch override migration", () => {
  it("extends cooldown overrides with a typed, targetable one-time authorization", () => {
    expect(migration).toContain("add column if not exists override_type text not null default 'skip_cooldown'");
    expect(migration).toContain("add column if not exists target_machine_code_hash text");
    expect(migration).toContain("add column if not exists target_device_id text");
    expect(migration).toContain("override_type in ('skip_cooldown', 'force_switch')");
    expect(migration).toContain("cloud_sync_cooldown_overrides_target_idx");
  });

  it("keeps skip-cooldown separate from force-switch authorizations", () => {
    expect(migration).toContain("public.find_active_cloud_sync_override");
    expect(migration).toContain("input_override_type text");
    expect(migration).toContain("and override_type = input_override_type");
    expect(migration).toContain("and (target_machine_code_hash is null or target_machine_code_hash = input_machine_code_hash)");
  });

  it("lets force-switch consume revoke the old active lease and then activate the target machine", () => {
    expect(migration).toContain("force_switch_override_id := public.find_active_cloud_sync_override");
    expect(migration).toContain("'force_switch'");
    expect(migration).toContain("'admin_force_switch'");
    expect(migration).toContain("'force_switch_consumed'");
    expect(migration).toContain("perform public.close_cloud_sync_usage_session(active_lease.id, input_now, 'admin_revoked')");
    expect(migration).toContain("active_lease := null");
  });

  it("does not let skip-cooldown bypass an active lease on another physical machine", () => {
    const conflictIndex = migration.indexOf("if found and active_lease.machine_code_hash <> session_row.machine_code_hash then");
    const skipCooldownIndex = migration.indexOf("skip_cooldown_override_id := public.find_active_cloud_sync_override");

    expect(conflictIndex).toBeGreaterThan(0);
    expect(skipCooldownIndex).toBeGreaterThan(conflictIndex);
  });
});
