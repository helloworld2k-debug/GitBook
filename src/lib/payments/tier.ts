import { donationTiers } from "@/config/site";

export type DonationTier = {
  id?: string;
  code: string;
  labelKey: string;
  label?: string;
  description?: string;
  amount: number;
  compareAtAmount: number | null;
  currency: string;
  sortOrder?: number;
};

type DonationTierClient = {
  from: unknown;
};

type DonationTierFrom = (table: "donation_tiers") => {
  select: (columns: "id,code,label,description,amount,compare_at_amount,currency,sort_order") => {
    eq: (column: "is_active", value: true) => {
      order: (
        column: "sort_order",
        options: { ascending: true },
      ) => PromiseLike<{
        data: Array<{
          id: string;
          code: string;
          label: string;
          description: string;
          amount: number;
          compare_at_amount: number | null;
          currency: string;
          sort_order: number;
        }> | null;
        error: unknown;
      }>;
    };
  };
};

export function findDonationTier(code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  return donationTiers.find((tier) => tier.code === code) ?? null;
}

export async function getActiveDonationTiers(client: DonationTierClient): Promise<DonationTier[]> {
  const from = client.from as DonationTierFrom;
  const { data, error } = await from("donation_tiers")
    .select("id,code,label,description,amount,compare_at_amount,currency,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Unable to read donation tiers");
  }

  if (!data || data.length === 0) {
    return donationTiers.map((tier, index) => ({ ...tier, sortOrder: index + 1 }));
  }

  return data.map((tier) => ({
    id: tier.id,
    code: tier.code,
    label: tier.label,
    description: tier.description,
    labelKey: `donate.tiers.${tier.code}`,
    amount: tier.amount,
    compareAtAmount: tier.compare_at_amount,
    currency: tier.currency,
    sortOrder: tier.sort_order,
  }));
}

export async function findActiveDonationTier(client: DonationTierClient, code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  const tiers = await getActiveDonationTiers(client);

  return tiers.find((tier) => tier.code === code) ?? null;
}
