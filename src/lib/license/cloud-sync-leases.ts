import { CLOUD_SYNC_LEASE_TTL_SECONDS } from "@/lib/license/constants";
import type { Database } from "@/lib/database.types";

type ActivateCloudSyncLeaseInput = {
  userId: string;
  desktopSessionId: string;
  deviceId: string;
  machineCodeHash: string;
  now?: Date;
};

type HeartbeatCloudSyncLeaseInput = {
  userId: string;
  desktopSessionId: string;
  now?: Date;
};

type ReleaseCloudSyncLeaseInput = {
  userId: string;
  desktopSessionId: string;
  now?: Date;
};

type CloudSyncLeaseRpcClient = {
  rpc: <FunctionName extends keyof Database["public"]["Functions"]>(
    functionName: FunctionName,
    args: Database["public"]["Functions"][FunctionName]["Args"],
  ) => PromiseLike<{
    data: Database["public"]["Functions"][FunctionName]["Returns"] | null;
    error: unknown;
  }>;
};

export type CloudSyncLeaseActivation = {
  ok: boolean;
  reason: "active" | "invalid_session";
  leaseId: string | null;
  expiresAt: string | null;
  activeDeviceId: string | null;
};

export type CloudSyncLeaseHeartbeat = {
  ok: boolean;
  reason: "active" | "active_on_another_device" | "invalid_session" | "lease_not_found";
  leaseId: string | null;
  expiresAt: string | null;
  activeDeviceId: string | null;
};

export type CloudSyncLeaseStatus = {
  ok: boolean;
  reason: "active" | "active_on_another_device";
  activeDeviceId: string | null;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function getLeaseTimes(nowInput?: Date) {
  const now = nowInput ?? new Date();

  return {
    expiresAt: addSeconds(now, CLOUD_SYNC_LEASE_TTL_SECONDS).toISOString(),
    nowIso: now.toISOString(),
  };
}

function isActivationReason(reason: string): reason is CloudSyncLeaseActivation["reason"] {
  return reason === "active" || reason === "invalid_session";
}

function isHeartbeatReason(reason: string): reason is CloudSyncLeaseHeartbeat["reason"] {
  return (
    reason === "active" ||
    reason === "active_on_another_device" ||
    reason === "invalid_session" ||
    reason === "lease_not_found"
  );
}

function isStatusReason(reason: string): reason is CloudSyncLeaseStatus["reason"] {
  return reason === "active" || reason === "active_on_another_device";
}

export async function activateCloudSyncLease(
  client: CloudSyncLeaseRpcClient,
  input: ActivateCloudSyncLeaseInput,
): Promise<CloudSyncLeaseActivation> {
  const { expiresAt, nowIso } = getLeaseTimes(input.now);
  const { data, error } = await client.rpc("activate_cloud_sync_lease", {
    input_desktop_session_id: input.desktopSessionId,
    input_device_id: input.deviceId,
    input_expires_at: expiresAt,
    input_machine_code_hash: input.machineCodeHash,
    input_now: nowIso,
    input_user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to activate cloud sync lease");
  }

  const row = data?.[0];

  if (!row || !isActivationReason(row.reason)) {
    throw new Error("Unable to activate cloud sync lease");
  }

  return {
    activeDeviceId: row.active_device_id,
    expiresAt: row.expires_at,
    leaseId: row.lease_id,
    ok: row.ok,
    reason: row.reason,
  };
}

export async function heartbeatCloudSyncLease(
  client: CloudSyncLeaseRpcClient,
  input: HeartbeatCloudSyncLeaseInput,
): Promise<CloudSyncLeaseHeartbeat> {
  const { expiresAt, nowIso } = getLeaseTimes(input.now);
  const { data, error } = await client.rpc("heartbeat_cloud_sync_lease", {
    input_desktop_session_id: input.desktopSessionId,
    input_expires_at: expiresAt,
    input_now: nowIso,
    input_user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to heartbeat cloud sync lease");
  }

  const row = data?.[0];

  if (!row || !isHeartbeatReason(row.reason)) {
    throw new Error("Unable to heartbeat cloud sync lease");
  }

  return {
    activeDeviceId: row.active_device_id,
    expiresAt: row.expires_at,
    leaseId: row.lease_id,
    ok: row.ok,
    reason: row.reason,
  };
}

export async function releaseCloudSyncLease(
  client: CloudSyncLeaseRpcClient,
  input: ReleaseCloudSyncLeaseInput,
): Promise<{ released: true }> {
  const now = input.now ?? new Date();
  const { data, error } = await client.rpc("release_cloud_sync_lease", {
    input_desktop_session_id: input.desktopSessionId,
    input_now: now.toISOString(),
    input_user_id: input.userId,
  });

  if (error || data !== true) {
    throw new Error("Unable to release cloud sync lease");
  }

  return { released: true };
}

export async function readCloudSyncLeaseStatus(
  client: CloudSyncLeaseRpcClient,
  input: ReleaseCloudSyncLeaseInput,
): Promise<CloudSyncLeaseStatus> {
  const now = input.now ?? new Date();
  const { data, error } = await client.rpc("read_cloud_sync_lease_status", {
    input_desktop_session_id: input.desktopSessionId,
    input_now: now.toISOString(),
    input_user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to read cloud sync lease status");
  }

  const row = data?.[0];

  if (!row || !isStatusReason(row.reason)) {
    throw new Error("Unable to read cloud sync lease status");
  }

  return {
    activeDeviceId: row.active_device_id,
    ok: row.ok,
    reason: row.reason,
  };
}
