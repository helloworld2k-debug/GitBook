import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0007_desktop_license.sql"), "utf8");

describe("desktop license migration", () => {
  it("creates license, trial, desktop session, and cloud sync lease tables", () => {
    expect(migration).toContain("create type license_feature_code as enum ('cloud_sync')");
    expect(migration).toContain("create type license_entitlement_status as enum ('active', 'expired', 'revoked')");
    expect(migration).toContain("create table public.license_entitlements");
    expect(migration).toContain("create table public.license_entitlement_grants");
    expect(migration).toContain("create table public.trial_codes");
    expect(migration).toContain("create table public.trial_code_redemptions");
    expect(migration).toContain("create table public.machine_trial_claims");
    expect(migration).toContain("create table public.desktop_auth_codes");
    expect(migration).toContain("create table public.desktop_sessions");
    expect(migration).toContain("create table public.desktop_devices");
    expect(migration).toContain("create table public.cloud_sync_leases");
    expect(migration).toContain("unique (machine_code_hash, feature_code)");
    expect(migration).toContain("unique (source_donation_id, feature_code)");
    expect(migration).toContain("cloud_sync_leases_one_active_per_user");
  });

  it("creates an atomic paid entitlement grant function", () => {
    expect(migration).toContain("create or replace function public.grant_cloud_sync_entitlement_for_donation");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("Paid donation not found for entitlement grant");
    expect(migration).toContain("from public.license_entitlement_grants");
    expect(migration).toContain("insert into public.license_entitlement_grants");
    expect(migration).toContain("on conflict (user_id, feature_code)");
    expect(migration).toContain(
      "revoke execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.grant_cloud_sync_entitlement_for_donation(uuid, uuid, integer, timestamptz) to service_role",
    );
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
    expect(migration).toContain("alter table public.license_entitlement_grants enable row level security");
    expect(migration).toContain("alter table public.trial_codes enable row level security");
    expect(migration).toContain("alter table public.desktop_sessions enable row level security");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toContain("auth.uid()");
  });
});
