import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0007_desktop_license.sql"), "utf8");

function getFunctionSql(functionName: string) {
  const start = migration.indexOf(`create or replace function public.${functionName}`);
  const next = migration.indexOf("\ncreate or replace function public.", start + 1);

  return migration.slice(start, next === -1 ? undefined : next);
}

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
    expect(migration).toContain("create table public.cloud_sync_settings");
    expect(migration).toContain("create table public.cloud_sync_cooldown_overrides");
    expect(migration).toContain("cloud_sync_device_switch_cooldown_minutes");
    expect(migration).toContain("values ('cloud_sync_device_switch_cooldown_minutes', '180')");
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
    const exchange = getFunctionSql("exchange_desktop_auth_code");

    expect(migration).toContain("create or replace function public.exchange_desktop_auth_code");
    expect(migration).toContain("returns table(user_id uuid, desktop_session_id uuid)");
    expect(migration).toContain("input_state text");
    expect(migration).toContain("state text not null");
    expect(migration).toContain("update public.desktop_auth_codes");
    expect(migration).toContain("where code_hash = input_code_hash");
    expect(migration).toContain("and state = input_state");
    expect(migration).toContain("and used_at is null");
    expect(migration).toContain("and expires_at > input_now");
    expect(migration).toContain("perform pg_advisory_xact_lock(hashtextextended(claimed_user_id::text, 0))");
    expect(exchange).not.toContain("update public.desktop_sessions");
    expect(exchange).not.toContain("update public.cloud_sync_leases");
    expect(migration).toContain("insert into public.desktop_devices");
    expect(migration).toContain("insert into public.desktop_sessions");
    expect(migration).toContain(
      "revoke execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.exchange_desktop_auth_code(text, text, text, text, text, text, text, text, timestamptz, timestamptz) to service_role",
    );
  });

  it("creates a service-role-only desktop session refresh function", () => {
    expect(migration).toContain("create or replace function public.refresh_desktop_session");
    expect(migration).toContain("input_current_token_hash text");
    expect(migration).toContain("input_new_token_hash text");
    expect(migration).toContain("where token_hash = input_current_token_hash");
    expect(migration).toContain("and revoked_at is null");
    expect(migration).toContain("and expires_at > input_now");
    expect(migration).toContain("token_hash = input_new_token_hash");
    expect(migration).toContain(
      "revoke execute on function public.refresh_desktop_session(text, text, timestamptz, timestamptz) from public",
    );
    expect(migration).toContain(
      "grant execute on function public.refresh_desktop_session(text, text, timestamptz, timestamptz) to service_role",
    );
  });

  it("creates service-role-only cloud sync lease RPCs with per-user locking", () => {
    expect(migration).toContain("create or replace function public.activate_cloud_sync_lease");
    expect(migration).toContain("create or replace function public.heartbeat_cloud_sync_lease");
    expect(migration).toContain("create or replace function public.read_cloud_sync_lease_status");
    expect(migration).toContain("create or replace function public.release_cloud_sync_lease");
    expect(migration).toContain("available_after timestamptz");
    expect(migration).toContain("remaining_seconds integer");
    expect(migration).toContain("perform pg_advisory_xact_lock(hashtextextended(input_user_id::text, 0))");
    expect(migration).toContain("and revoked_at is null");
    expect(migration).toContain("'active_on_another_device'::text");
    expect(migration).toContain("'cooldown_waiting'::text");
    expect(migration).toContain("public.has_active_cloud_sync_cooldown_override");
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

  it("creates an atomic admin desktop session revocation RPC that revokes active leases", () => {
    const revocation = getFunctionSql("revoke_desktop_session_with_leases");

    expect(revocation).toContain("input_desktop_session_id uuid");
    expect(revocation).toContain("input_now timestamptz");
    expect(revocation).toContain("update public.desktop_sessions");
    expect(revocation).toContain("revoked_at = input_now");
    expect(revocation).toContain("cloud_sync_active_until = null");
    expect(revocation).toContain("where id = input_desktop_session_id");
    expect(revocation).toContain("for update");
    expect(revocation).toContain("update public.cloud_sync_leases");
    expect(revocation).toContain("desktop_session_id = input_desktop_session_id");
    expect(revocation).toContain("and revoked_at is null");
    expect(revocation).toContain(
      "revoke execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) from public",
    );
    expect(revocation).toContain(
      "grant execute on function public.revoke_desktop_session_with_leases(uuid, timestamptz) to service_role",
    );
  });

  it("revalidates and locks desktop sessions inside trust-critical lease RPCs", () => {
    const activation = getFunctionSql("activate_cloud_sync_lease");
    const heartbeat = getFunctionSql("heartbeat_cloud_sync_lease");

    for (const functionSql of [activation, heartbeat]) {
      expect(functionSql).toContain("session_row public.desktop_sessions%rowtype");
      expect(functionSql).toContain("from public.desktop_sessions");
      expect(functionSql).toContain("where id = input_desktop_session_id");
      expect(functionSql).toContain("and user_id = input_user_id");
      expect(functionSql).toContain("and revoked_at is null");
      expect(functionSql).toContain("and expires_at > input_now");
      expect(functionSql).toContain("for update");
      expect(functionSql).toContain(
        "return query select false, 'invalid_session'::text, null::uuid, null::timestamptz, null::text",
      );
    }

    expect(activation).toContain("and device_id = input_device_id");
    expect(activation).toContain("and machine_code_hash = input_machine_code_hash");
    expect(activation).toContain("session_row.user_id");
    expect(activation).toContain("session_row.id");
    expect(activation).toContain("session_row.device_id");
    expect(activation).toContain("session_row.machine_code_hash");
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
