import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

type LicenseStatusClient = {
  from: unknown;
};

type LicenseStatusFrom = (table: "machine_trial_claims") => {
  select: (columns: "trial_valid_until") => {
    eq: (
      column: "machine_code_hash" | "feature_code",
      value: string,
    ) => {
      eq: (
        column: "machine_code_hash" | "feature_code",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: { trial_valid_until: string } | null; error: unknown }>;
      };
    };
  };
};

type LicenseStatusInput = {
  userId: string;
  machineCodeHash: string;
  now?: Date;
};

export type LicenseStatus =
  | {
      allowed: true;
      feature: typeof CLOUD_SYNC_FEATURE;
      reason: "active";
      source: "paid";
      validUntil: string | null;
      remainingDays: number;
    }
  | {
      allowed: true;
      feature: typeof CLOUD_SYNC_FEATURE;
      reason: "trial_active";
      source: "trial";
      validUntil: string;
      remainingDays: number;
    }
  | {
      allowed: false;
      feature: typeof CLOUD_SYNC_FEATURE;
      reason: "expired" | "revoked" | "trial_code_required" | "trial_expired";
      validUntil: string | null;
      remainingDays: number;
    };

function remainingDaysUntil(validUntil: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86_400_000));
}

export async function getLicenseStatus(client: LicenseStatusClient, input: LicenseStatusInput): Promise<LicenseStatus> {
  const now = input.now ?? new Date();
  const paidStatus = await getCloudSyncEntitlementStatus(
    client as Parameters<typeof getCloudSyncEntitlementStatus>[0],
    input.userId,
    now,
  );

  if (paidStatus.allowed) {
    return {
      allowed: true,
      feature: CLOUD_SYNC_FEATURE,
      reason: "active",
      source: "paid",
      validUntil: paidStatus.validUntil,
      remainingDays: paidStatus.remainingDays,
    };
  }

  if (paidStatus.reason === "revoked") {
    return {
      allowed: false,
      feature: CLOUD_SYNC_FEATURE,
      reason: "revoked",
      validUntil: paidStatus.validUntil,
      remainingDays: 0,
    };
  }

  const from = client.from as LicenseStatusFrom;
  const { data, error } = await from("machine_trial_claims")
    .select("trial_valid_until")
    .eq("machine_code_hash", input.machineCodeHash)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to read machine trial");
  }

  if (data) {
    const validUntil = data.trial_valid_until as string;

    if (new Date(validUntil) <= now) {
      return {
        allowed: false,
        feature: CLOUD_SYNC_FEATURE,
        reason: "trial_expired",
        validUntil,
        remainingDays: 0,
      };
    }

    return {
      allowed: true,
      feature: CLOUD_SYNC_FEATURE,
      reason: "trial_active",
      source: "trial",
      validUntil,
      remainingDays: remainingDaysUntil(validUntil, now),
    };
  }

  if (paidStatus.reason === "no_entitlement") {
    return {
      allowed: false,
      feature: CLOUD_SYNC_FEATURE,
      reason: "trial_code_required",
      validUntil: null,
      remainingDays: 0,
    };
  }

  return {
    allowed: false,
    feature: CLOUD_SYNC_FEATURE,
    reason: "expired",
    validUntil: paidStatus.validUntil,
    remainingDays: paidStatus.remainingDays,
  };
}
