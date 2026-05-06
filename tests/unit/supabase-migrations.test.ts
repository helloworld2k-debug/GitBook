import { readFileSync, readdirSync } from "node:fs";
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

  it("stores editable contribution tier original prices and current defaults", () => {
    const initialSchema = readFileSync(join(process.cwd(), "supabase/migrations/0001_initial_schema.sql"), "utf8");
    const pricingSettingsMigration = readFileSync(join(process.cwd(), "supabase/migrations/0017_donation_tier_pricing_settings.sql"), "utf8");

    expect(initialSchema).toContain("compare_at_amount integer check (compare_at_amount is null or compare_at_amount > amount)");
    expect(initialSchema).toContain("('monthly', 'Monthly Support', 'One-time support equal to a monthly contribution.', 900, null, 'usd', 1)");
    expect(initialSchema).toContain("('quarterly', 'Quarterly Support', 'One-time support equal to a quarterly contribution.', 2430, 2700, 'usd', 2)");
    expect(initialSchema).toContain("('yearly', 'Yearly Support', 'One-time support equal to a yearly contribution.', 8640, 10800, 'usd', 3)");
    expect(pricingSettingsMigration).toContain("add column if not exists compare_at_amount integer");
    expect(pricingSettingsMigration).toContain("amount = 2430");
    expect(pricingSettingsMigration).toContain("compare_at_amount = 10800");
  });
});
