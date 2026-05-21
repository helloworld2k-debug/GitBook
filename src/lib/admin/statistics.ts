/**
 * Statistics aggregation helpers for admin dashboard charts
 * These functions help prepare data for chart components
 */

export type DonationStats = {
  date: string;
  amount: number;
  count: number;
};

export type UserGrowthStats = {
  date: string;
  count: number;
};

/**
 * Groups donations by date for trend charts
 */
export function groupDonationsByDate(
  donations: Array<{ created_at: string; amount: number }>,
): DonationStats[] {
  const grouped = new Map<string, { amount: number; count: number }>();

  for (const donation of donations) {
    const date = new Date(donation.created_at).toISOString().split("T")[0];
    const existing = grouped.get(date);

    if (existing) {
      existing.amount += donation.amount;
      existing.count += 1;
    } else {
      grouped.set(date, { amount: donation.amount, count: 1 });
    }
  }

  return Array.from(grouped.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Groups users by registration date for growth charts
 */
export function groupUsersByDate(
  users: Array<{ created_at: string }>,
): UserGrowthStats[] {
  const grouped = new Map<string, number>();

  for (const user of users) {
    const date = new Date(user.created_at).toISOString().split("T")[0];
    const existing = grouped.get(date) || 0;
    grouped.set(date, existing + 1);
  }

  // Calculate cumulative count
  let cumulative = 0;
  return Array.from(grouped.entries())
    .map(([date, count]) => {
      cumulative += count;
      return { date, count: cumulative };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Formats currency for display in charts
 */
export function formatCurrencyForChart(
  amountInCents: number,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}
