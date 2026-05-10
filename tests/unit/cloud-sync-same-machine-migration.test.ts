import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0026_cloud_sync_same_machine_relogin.sql"),
  "utf8",
);

describe("cloud sync same-machine relogin migration", () => {
  it("lets a new desktop session on the same physical machine reclaim the active lease", () => {
    expect(migration).toContain("create or replace function public.activate_cloud_sync_lease");
    expect(migration).toContain("active_lease.machine_code_hash <> session_row.machine_code_hash");
    expect(migration).not.toContain("active_lease.desktop_session_id <> input_desktop_session_id");
    expect(migration).toContain("desktop_session_id = session_row.id");
    expect(migration).toContain("device_id = session_row.device_id");
    expect(migration).toContain("machine_code_hash = session_row.machine_code_hash");
  });

  it("applies cooldown only when switching to a different physical machine", () => {
    expect(migration).toContain("csl.machine_code_hash <> session_row.machine_code_hash");
    expect(migration).not.toContain("csl.desktop_session_id <> input_desktop_session_id");
    expect(migration).toContain("'cooldown_waiting'::text");
    expect(migration).toContain("public.has_active_cloud_sync_cooldown_override");
  });
});
