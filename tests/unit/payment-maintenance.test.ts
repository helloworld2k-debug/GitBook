import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getPaymentCheckoutStatus } from "@/lib/payments/maintenance";

describe("payment checkout maintenance", () => {
  it("reads the checkout pause setting from operational settings", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                value: {
                  is_paused: true,
                  message: "Payment is temporarily unavailable while we investigate checkout.",
                },
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    await expect(getPaymentCheckoutStatus(client)).resolves.toEqual({
      isPaused: true,
      message: "Payment is temporarily unavailable while we investigate checkout.",
    });
    expect(client.from).toHaveBeenCalledWith("operational_settings");
  });

  it("defaults to available checkout when the setting table is unavailable", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("table unavailable");
      }),
    };

    await expect(getPaymentCheckoutStatus(client)).resolves.toEqual({
      isPaused: false,
      message: null,
    });
  });

  it("creates the operational settings table and payment checkout row", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/0059_operational_settings.sql"), "utf8");

    expect(migration).toContain("create table if not exists public.operational_settings");
    expect(migration).toContain("'payment_checkout'");
    expect(migration).toContain('"is_paused"');
    expect(migration).toContain('create policy "Public reads payment checkout operational setting"');
    expect(migration).toContain("using (key = 'payment_checkout')");
    expect(migration).toContain("auth.role() = 'service_role'");
  });
});
