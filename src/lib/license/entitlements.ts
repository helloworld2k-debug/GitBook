import { CLOUD_SYNC_FEATURE, getEntitlementDaysForTier } from "@/lib/license/constants";

type EntitlementClient = {
  from: unknown;
  rpc: (
    functionName: "grant_cloud_sync_entitlement_for_donation",
    args: {
      input_days: number;
      input_donation_id: string;
      input_paid_at: string;
      input_user_id: string;
    },
  ) => PromiseLike<{ data: string | null; error: unknown }>;
};

type EntitlementFrom = (table: "license_entitlements") => {
  select: (columns: "valid_until,status") => {
    eq: (
      column: "user_id" | "feature_code",
      value: string,
    ) => {
      eq: (
        column: "user_id" | "feature_code",
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{
          data: { valid_until: string; status: "active" | "expired" | "revoked" } | null;
          error: unknown;
        }>;
      };
    };
  };
};

type ExtendInput = {
  userId: string;
  donationId: string;
  tierCode: string;
  paidAt: Date;
};

export type LicenseReason = "active" | "expired" | "no_entitlement" | "revoked";

export type EntitlementStatus = {
  allowed: boolean;
  reason: LicenseReason;
  source?: "paid";
  validUntil: string | null;
  remainingDays: number;
};

function remainingDaysUntil(validUntil: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86_400_000));
}

export async function extendCloudSyncEntitlementForDonation(client: EntitlementClient, input: ExtendInput) {
  const days = getEntitlementDaysForTier(input.tierCode);

  if (!days) {
    throw new Error("Unsupported entitlement tier");
  }

  const { data, error } = await client.rpc("grant_cloud_sync_entitlement_for_donation", {
    input_days: days,
    input_donation_id: input.donationId,
    input_paid_at: input.paidAt.toISOString(),
    input_user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to extend entitlement");
  }

  if (typeof data !== "string") {
    throw new Error("Unable to extend entitlement");
  }

  return data;
}

export async function getCloudSyncEntitlementStatus(
  client: EntitlementClient,
  userId: string,
  now = new Date(),
): Promise<EntitlementStatus> {
  const from = client.from as EntitlementFrom;
  const { data, error } = await from("license_entitlements")
    .select("valid_until,status")
    .eq("user_id", userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to read entitlement");
  }

  if (!data) {
    return { allowed: false, reason: "no_entitlement", validUntil: null, remainingDays: 0 };
  }

  if (data.status === "revoked") {
    return { allowed: false, reason: "revoked", validUntil: data.valid_until, remainingDays: 0 };
  }

  if (new Date(data.valid_until) <= now) {
    return { allowed: false, reason: "expired", validUntil: data.valid_until, remainingDays: 0 };
  }

  return {
    allowed: true,
    reason: "active",
    source: "paid",
    validUntil: data.valid_until,
    remainingDays: remainingDaysUntil(data.valid_until, now),
  };
}
