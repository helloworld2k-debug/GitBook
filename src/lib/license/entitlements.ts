import { CLOUD_SYNC_FEATURE, getEntitlementDaysForTier } from "@/lib/license/constants";

type EntitlementClient = {
  from: (table: string) => any;
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function remainingDaysUntil(validUntil: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86_400_000));
}

export async function extendCloudSyncEntitlementForDonation(client: EntitlementClient, input: ExtendInput) {
  const days = getEntitlementDaysForTier(input.tierCode);

  if (!days) {
    throw new Error("Unsupported entitlement tier");
  }

  const { data: current, error: currentError } = await client
    .from("license_entitlements")
    .select("id,valid_until,status,source_donation_id")
    .eq("user_id", input.userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (currentError) {
    throw new Error("Unable to read entitlement");
  }

  if (current?.source_donation_id === input.donationId) {
    return current.valid_until;
  }

  const currentValidUntil = current?.status === "active" && current.valid_until ? new Date(current.valid_until) : null;
  const start = currentValidUntil && currentValidUntil > input.paidAt ? currentValidUntil : input.paidAt;
  const validUntil = addDays(start, days).toISOString();

  const { error } = await client
    .from("license_entitlements")
    .upsert(
      {
        user_id: input.userId,
        feature_code: CLOUD_SYNC_FEATURE,
        valid_until: validUntil,
        status: "active",
        source_donation_id: input.donationId,
      },
      { onConflict: "user_id,feature_code" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to extend entitlement");
  }

  return validUntil;
}

export async function getCloudSyncEntitlementStatus(
  client: EntitlementClient,
  userId: string,
  now = new Date(),
): Promise<EntitlementStatus> {
  const { data, error } = await client
    .from("license_entitlements")
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
