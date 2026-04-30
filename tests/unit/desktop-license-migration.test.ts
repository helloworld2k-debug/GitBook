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

  it("creates a service-role-only atomic desktop auth exchange function", () => {
    expect(migration).toContain("create or replace function public.exchange_desktop_auth_code");
    expect(migration).toContain("returns table(user_id uuid, desktop_session_id uuid)");
    expect(migration).toContain("update public.desktop_auth_codes");
    expect(migration).toContain("where code_hash = input_code_hash");
    expect(migration).toContain("and used_at is null");
    expect(migration).toContain("and expires_at > input_now");
    expect(migration).toContain("insert into public.desktop_devices");
    expect(migration).toContain("insert into public.desktop_sessions");
    expect(migration).toContain(
      "revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz) to service_role",
    );
  });

  it("creates service-role-only cloud sync lease RPCs with per-user locking", () => {
    expect(migration).toContain("create or replace function public.activate_cloud_sync_lease");
    expect(migration).toContain("create or replace function public.heartbeat_cloud_sync_lease");
    expect(migration).toContain("create or replace function public.read_cloud_sync_lease_status");
    expect(migration).toContain("create or replace function public.release_cloud_sync_lease");
    expect(migration).toContain("returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text)");
    expect(migration).toContain("perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0))");
    expect(migration).toContain("and revoked_at is null");
    expect(migration).toContain("'active_on_another_device'::text");
    expect(migration).toContain("cloud_sync_active_until = input_expires_at");
    expect(migration).toContain(
      "revoke execute on function public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.read_cloud_sync_lease_status(uuid, uuid, timestamptz) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.release_cloud_sync_lease(uuid, uuid, timestamptz) to service_role",
    );
  });

  it("creates a service-role-only atomic trial code redemption function", () => {
    expect(migration).toContain("create or replace function public.redeem_trial_code");
    expect(migration).toContain("input_code_hash text");
    expect(migration).toContain("input_machine_code_hash text");
    expect(migration).toContain("returns table(ok boolean, reason text, valid_until timestamptz)");
    expect(migration).toContain("trial_code_invalid");
    expect(migration).toContain("trial_code_inactive");
    expect(migration).toContain("trial_code_limit_reached");
    expect(migration).toContain("machine_trial_used");
    expect(migration).toContain("duplicate_trial_code_user");
    expect(migration).toContain("insert into public.machine_trial_claims");
    expect(migration).toContain("insert into public.trial_code_redemptions");
    expect(migration).toContain("redemption_count = redemption_count + 1");
    expect(migration).toContain(
      "revoke execute on function public.redeem_trial_code(uuid, text, text, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.redeem_trial_code(uuid, text, text, timestamptz) to service_role",
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
