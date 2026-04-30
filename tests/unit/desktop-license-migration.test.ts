import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0007_desktop_license.sql"), "utf8");

describe("desktop license migration", () => {
  it("creates license, trial, desktop session, and cloud sync lease tables", () => {
    expect(migration).toContain("create type license_feature_code as enum ('cloud_sync')");
    expect(migration).toContain("create type license_entitlement_status as enum ('active', 'expired', 'revoked')");
    expect(migration).toContain("create table public.license_entitlements");
    expect(migration).toContain("create table public.trial_codes");
    expect(migration).toContain("create table public.trial_code_redemptions");
    expect(migration).toContain("create table public.machine_trial_claims");
    expect(migration).toContain("create table public.desktop_auth_codes");
    expect(migration).toContain("create table public.desktop_sessions");
    expect(migration).toContain("create table public.desktop_devices");
    expect(migration).toContain("create table public.cloud_sync_leases");
    expect(migration).toContain("unique (machine_code_hash, feature_code)");
    expect(migration).toContain("cloud_sync_leases_one_active_per_user");
  });

  it("keeps sensitive code and token fields hashed", () => {
    expect(migration).toContain("code_hash text not null");
    expect(migration).toContain("token_hash text not null");
    expect(migration).toContain("machine_code_hash text not null");
    expect(migration).not.toContain("raw_code");
    expect(migration).not.toContain("raw_token");
    expect(migration).not.toContain("machine_code text");
  });

  it("enables RLS and admin access policies", () => {
    expect(migration).toContain("alter table public.license_entitlements enable row level security");
    expect(migration).toContain("alter table public.trial_codes enable row level security");
    expect(migration).toContain("alter table public.desktop_sessions enable row level security");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toContain("auth.uid()");
  });
});
