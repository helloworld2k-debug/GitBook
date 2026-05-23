import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDodoProductId } from "@/lib/payments/dodo";

describe("payment product settings", () => {
  afterEach(() => {
    delete process.env.DODO_PAYMENTS_ENV;
    delete process.env.DODO_PRODUCT_MONTHLY;
    delete process.env.DODO_PRODUCT_QUARTERLY;
    delete process.env.DODO_PRODUCT_YEARLY;
    delete process.env.DODO_LIVE_PRODUCT_MONTHLY;
    delete process.env.DODO_LIVE_PRODUCT_QUARTERLY;
    delete process.env.DODO_LIVE_PRODUCT_YEARLY;
  });

  it("prefers enabled database settings for the selected Dodo environment", async () => {
    process.env.DODO_PRODUCT_YEARLY = "pdt_env_yearly";
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: { product_id: "pdt_db_yearly" },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(getDodoProductId("yearly", { client, environment: "test" })).resolves.toBe("pdt_db_yearly");
    expect(client.from).toHaveBeenCalledWith("payment_product_settings");
  });

  it("uses live-specific environment variables for live checkout fallback", async () => {
    process.env.DODO_PAYMENTS_ENV = "live";
    process.env.DODO_PRODUCT_MONTHLY = "pdt_test_monthly";
    process.env.DODO_LIVE_PRODUCT_MONTHLY = "pdt_live_monthly";

    await expect(getDodoProductId("monthly")).resolves.toBe("pdt_live_monthly");
  });

  it("keeps legacy Dodo product variables as a fallback when no database row exists", async () => {
    process.env.DODO_PRODUCT_QUARTERLY = "pdt_env_quarterly";
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    await expect(getDodoProductId("quarterly", { client, environment: "test" })).resolves.toBe("pdt_env_quarterly");
  });

  it("creates a unique payment product settings table", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/0056_payment_product_settings.sql"), "utf8");

    expect(migration).toContain("create table if not exists public.payment_product_settings");
    expect(migration).toContain("unique (provider, environment, tier_code)");
    expect(migration).toContain("environment in ('test', 'live')");
    expect(migration).toContain("tier_code in ('monthly', 'quarterly', 'yearly')");
  });

  it("seeds the live Dodo product IDs for all public support tiers", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/0057_seed_live_dodo_product_settings.sql"), "utf8");

    expect(migration).toContain("'monthly', 'pdt_0NfSHqPkQZGNWArp4uJAF'");
    expect(migration).toContain("'quarterly', 'pdt_0NfSHxjFX1RpH7lW8fk6k'");
    expect(migration).toContain("'yearly', 'pdt_0NfSI4XGVWDVQ4Kt08DEz'");
    expect(migration).toContain("on conflict (provider, environment, tier_code)");
  });
});
