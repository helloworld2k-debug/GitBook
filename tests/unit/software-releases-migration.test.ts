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
});
