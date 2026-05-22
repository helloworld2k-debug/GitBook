import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0054_backfill_dodo_cloud_sync_entitlements.sql"),
  "utf8",
);
const repairMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0055_repair_dodo_cloud_sync_entitlement_summary.sql"),
  "utf8",
);

describe("Dodo entitlement backfill migration", () => {
  it("backfills paid Dodo donations through the existing idempotent entitlement RPC", () => {
    expect(migration).toContain("from public.donations paid_donation");
    expect(migration).toContain("paid_donation.provider = 'dodo'");
    expect(migration).toContain("paid_donation.status = 'paid'");
    expect(migration).toContain("public.grant_cloud_sync_entitlement_for_donation");
    expect(migration).toContain("input_donation_id => donation_row.id");
  });

  it("maps known payment tiers to month-based cloud sync duration", () => {
    expect(migration).toContain("when 'monthly' then 1");
    expect(migration).toContain("when 'quarterly' then 3");
    expect(migration).toContain("when 'yearly' then 12");
    expect(migration).toContain("paid_donation.metadata->>'tier' in ('monthly', 'quarterly', 'yearly')");
  });
});

describe("Dodo entitlement summary repair migration", () => {
  it("rebuilds the user-facing entitlement summary from Dodo grant ledger rows", () => {
    expect(repairMigration).toContain("from public.license_entitlement_grants grant_row");
    expect(repairMigration).toContain("join public.donations donation_row");
    expect(repairMigration).toContain("donation_row.provider = 'dodo'");
    expect(repairMigration).toContain("on conflict (user_id, feature_code)");
    expect(repairMigration).toContain("grant_row.valid_until desc");
  });

  it("keeps the entitlement RPC idempotent while repairing missing summary rows", () => {
    expect(repairMigration).toContain("if existing_valid_until is not null then");
    expect(repairMigration).toContain("insert into public.license_entitlements");
    expect(repairMigration).toContain("return existing_valid_until");
  });
});
