import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0006_software_releases.sql"), "utf8");

describe("software releases migration", () => {
  it("creates release tables, public storage bucket, and admin policies", () => {
    expect(migration).toContain("create table public.software_releases");
    expect(migration).toContain("create table public.software_release_assets");
    expect(migration).toContain("software-releases");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toContain("is_published = true");
    expect(migration).toContain("storage.objects");
  });

  it("keeps the local storage upload limit compatible with 60 MB release installers", () => {
    const supabaseConfig = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");

    expect(supabaseConfig).toContain('file_size_limit = "80MiB"');
  });

  it("raises the software release storage bucket limit to 80 MiB", () => {
    const storageLimitMigration = readFileSync(join(process.cwd(), "supabase/migrations/0062_software_release_storage_limit.sql"), "utf8");

    expect(storageLimitMigration).toContain("update storage.buckets");
    expect(storageLimitMigration).toContain("file_size_limit = 83886080");
    expect(storageLimitMigration).toContain("where id = 'software-releases'");
  });

  it("adds visible upload lifecycle states to software releases", () => {
    const statusMigration = readFileSync(join(process.cwd(), "supabase/migrations/0036_software_release_upload_status.sql"), "utf8");

    expect(statusMigration).toContain("add column if not exists release_status text not null default 'ready'");
    expect(statusMigration).toContain("check (release_status in ('draft', 'uploading', 'ready', 'failed'))");
  });
});
