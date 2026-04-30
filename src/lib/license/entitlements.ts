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

type DonationMetadata = Record<string, unknown>;

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

function getMetadataObject(metadata: unknown): DonationMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as DonationMetadata;
}

function getGrantedValidUntil(metadata: DonationMetadata) {
  if (
    metadata.cloud_sync_entitlement_granted_at &&
    typeof metadata.cloud_sync_entitlement_valid_until === "string" &&
    metadata.cloud_sync_entitlement_valid_until
  ) {
    return metadata.cloud_sync_entitlement_valid_until;
  }

  return null;
}

async function markDonationEntitlementGranted(
  client: EntitlementClient,
  donationId: string,
  metadata: DonationMetadata,
  validUntil: string,
) {
  const { error } = await client
    .from("donations")
    .update({
      metadata: {
        ...metadata,
        cloud_sync_entitlement_granted_at: new Date().toISOString(),
        cloud_sync_entitlement_valid_until: validUntil,
      },
    })
    .eq("id", donationId);

  if (error) {
    throw new Error("Unable to mark donation entitlement grant");
  }
}

export async function extendCloudSyncEntitlementForDonation(client: EntitlementClient, input: ExtendInput) {
  const days = getEntitlementDaysForTier(input.tierCode);

  if (!days) {
    throw new Error("Unsupported entitlement tier");
  }

  const { data: donation, error: donationError } = await client
    .from("donations")
    .select("metadata")
    .eq("id", input.donationId)
    .single();

  if (donationError || !donation) {
    throw new Error("Unable to read donation entitlement metadata");
  }

  const donationMetadata = getMetadataObject(donation.metadata);
  const grantedValidUntil = getGrantedValidUntil(donationMetadata);

  if (grantedValidUntil) {
    return grantedValidUntil;
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
    await markDonationEntitlementGranted(client, input.donationId, donationMetadata, current.valid_until);
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

  await markDonationEntitlementGranted(client, input.donationId, donationMetadata, validUntil);

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
