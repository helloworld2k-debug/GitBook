export const CLOUD_SYNC_FEATURE = "cloud_sync" as const;
export const DESKTOP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const DESKTOP_SESSION_TTL_DAYS = 30;
export const CLOUD_SYNC_LEASE_TTL_SECONDS = 120;

const entitlementDaysByTier: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export function getEntitlementDaysForTier(tierCode: string | null | undefined) {
  if (!tierCode) {
    return null;
  }

  return entitlementDaysByTier[tierCode] ?? null;
}
