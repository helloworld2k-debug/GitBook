import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Supabase migrations", () => {
  it("uses unique migration versions so remote pushes cannot skip files", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const versions = readdirSync(migrationsDir)
      .filter((fileName) => fileName.endsWith(".sql"))
      .map((fileName) => fileName.split("_")[0]);
    const duplicateVersions = versions.filter((version, index) => versions.indexOf(version) !== index);

    expect(duplicateVersions).toEqual([]);
  });
});
