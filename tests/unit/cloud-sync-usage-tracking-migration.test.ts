import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0031_cloud_sync_usage_tracking.sql"),
  "utf8",
);

describe("cloud sync usage tracking migration", () => {
  it("creates usage session and event tables for admin diagnostics", () => {
    expect(migration).toContain("create table public.cloud_sync_usage_sessions");
    expect(migration).toContain("create table public.cloud_sync_usage_events");
    expect(migration).toContain("end_reason text");
    expect(migration).toContain("event_type text not null");
    expect(migration).toContain("heartbeat_count integer not null default 0");
    expect(migration).toContain("cloud_sync_usage_sessions_user_started_idx");
    expect(migration).toContain("cloud_sync_usage_events_user_occurred_idx");
    expect(migration).toContain("alter table public.cloud_sync_usage_sessions enable row level security");
    expect(migration).toContain("cloud_sync_usage_sessions_admin_all");
  });

  it("records success, conflict, cooldown, heartbeat, release, and support-denied events", () => {
    expect(migration).toContain("public.record_cloud_sync_usage_event");
    expect(migration).toContain("'activate_success'");
    expect(migration).toContain("'activate_conflict'");
    expect(migration).toContain("'cooldown_waiting'");
    expect(migration).toContain("'same_machine_takeover'");
    expect(migration).toContain("'heartbeat_success'");
    expect(migration).toContain("'release'");
    expect(migration).toContain("'support_denied'");
  });

  it("returns usage session ids from activation and heartbeat RPCs", () => {
    expect(migration).toContain("usage_session_id uuid");
    expect(migration).toContain("return query select true, 'active'::text");
    expect(migration).toContain("active_usage_session.id");
    expect(migration).toContain("returns table(ok boolean, reason text, lease_id uuid, expires_at timestamptz, active_device_id text, usage_session_id uuid)");
  });

  it("drops old cloud sync RPC signatures before changing return columns", () => {
    expect(migration).toContain("drop function if exists public.activate_cloud_sync_lease(uuid, uuid, text, text, timestamptz, timestamptz)");
    expect(migration).toContain("drop function if exists public.heartbeat_cloud_sync_lease(uuid, uuid, timestamptz, timestamptz)");
  });

  it("closes usage sessions on release and admin revocation", () => {
    expect(migration).toContain("public.close_cloud_sync_usage_session");
    expect(migration).toContain("'released'");
    expect(migration).toContain("'admin_revoked'");
    expect(migration).toContain("create or replace function public.revoke_cloud_sync_lease_with_usage");
  });

  it("backfills historical lease rows as inferred usage sessions", () => {
    expect(migration).toContain("insert into public.cloud_sync_usage_sessions");
    expect(migration).toContain("'historical_inferred'");
    expect(migration).toContain("from public.cloud_sync_leases as csl");
    expect(migration).toContain("on conflict (lease_id) do nothing");
  });
});
