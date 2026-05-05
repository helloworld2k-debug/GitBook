import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0015_release_delivery_mode.sql"), "utf8");

describe("software release delivery mode migration", () => {
  it("adds release delivery mode and explicit platform link fields", () => {
    expect(migration).toContain("add column if not exists delivery_mode text not null default 'file'");
    expect(migration).toContain("check (delivery_mode in ('file', 'link'))");
    expect(migration).toContain("add column if not exists macos_primary_url text");
    expect(migration).toContain("add column if not exists macos_backup_url text");
    expect(migration).toContain("add column if not exists windows_primary_url text");
    expect(migration).toContain("add column if not exists windows_backup_url text");
  });
});
