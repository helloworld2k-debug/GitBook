export const CLOUD_SYNC_FEATURE = "cloud_sync" as const;
export const DESKTOP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const DESKTOP_SESSION_TTL_DAYS = 30;
export const CLOUD_SYNC_LEASE_TTL_SECONDS = 120;

const entitlementMonthsByTier: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function getEntitlementMonthsForTier(tierCode: string | null | undefined) {
  if (!tierCode) {
    return null;
  }

  return entitlementMonthsByTier[tierCode] ?? null;
}

export function getEntitlementDaysForTier(tierCode: string | null | undefined) {
  const months = getEntitlementMonthsForTier(tierCode);

  if (!months) {
    return null;
  }

  return months === 12 ? 365 : months * 30;
}
