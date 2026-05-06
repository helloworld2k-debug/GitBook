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
  isActive?: boolean;
  sortOrder?: number;
};

type DonationTierClient = {
  from: unknown;
};

type DonationTierRow = {
  id: string;
  code: string;
  label: string;
  description: string;
  amount: number;
  compare_at_amount?: number | null;
  currency: string;
  is_active?: boolean;
  sort_order: number;
};

type DonationTierQueryResult = {
  data: DonationTierRow[] | null;
  error: unknown;
};

type DonationTierOrderQuery = {
  order: (
    column: "sort_order",
    options: { ascending: true },
  ) => PromiseLike<DonationTierQueryResult>;
};

type DonationTierFilterQuery = {
  eq: (column: "is_active", value: true) => DonationTierOrderQuery;
} & DonationTierOrderQuery;

type DonationTierFrom = (table: "donation_tiers") => {
  select: (
    columns:
      | "id,code,label,description,amount,compare_at_amount,currency,sort_order"
      | "id,code,label,description,amount,currency,sort_order"
      | "id,code,label,description,amount,compare_at_amount,currency,sort_order,is_active"
      | "id,code,label,description,amount,currency,sort_order,is_active",
  ) => DonationTierFilterQuery;
};

function mapDonationTierRows(data: DonationTierRow[]): DonationTier[] {
  return data.map((tier) => ({
    id: tier.id,
    code: tier.code,
    label: tier.label,
    description: tier.description,
    labelKey: `donate.tiers.${tier.code}`,
    amount: tier.amount,
    compareAtAmount: tier.compare_at_amount ?? getConfiguredCompareAtAmount(tier.code),
    currency: tier.currency,
    isActive: tier.is_active,
    sortOrder: tier.sort_order,
  }));
}

async function readDonationTiers(
  client: DonationTierClient,
  columns:
    | "id,code,label,description,amount,compare_at_amount,currency,sort_order"
    | "id,code,label,description,amount,compare_at_amount,currency,sort_order,is_active",
  legacyColumns:
    | "id,code,label,description,amount,currency,sort_order"
    | "id,code,label,description,amount,currency,sort_order,is_active",
  onlyActive: boolean,
) {
  const from = client.from as DonationTierFrom;
  const orderedQuery = onlyActive ? from("donation_tiers").select(columns).eq("is_active", true) : from("donation_tiers").select(columns);
  let { data, error } = await orderedQuery.order("sort_order", { ascending: true });

  if (isMissingCompareAtAmountError(error)) {
    const legacyOrderedQuery = onlyActive ? from("donation_tiers").select(legacyColumns).eq("is_active", true) : from("donation_tiers").select(legacyColumns);
    const legacyResult = await legacyOrderedQuery.order("sort_order", { ascending: true });

    data = legacyResult.data;
    error = legacyResult.error;
  }

  return { data, error };
}

function isMissingCompareAtAmountError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return code === "42703" || message.includes("compare_at_amount");
}

function getConfiguredCompareAtAmount(code: string) {
  return donationTiers.find((tier) => tier.code === code)?.compareAtAmount ?? null;
}

function getConfiguredDonationTiers() {
  return donationTiers.map((tier, index) => ({ ...tier, sortOrder: index + 1 }));
}

export function findDonationTier(code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  return donationTiers.find((tier) => tier.code === code) ?? null;
}

export async function getActiveDonationTiers(client: DonationTierClient): Promise<DonationTier[]> {
  const { data, error } = await readDonationTiers(
    client,
    "id,code,label,description,amount,compare_at_amount,currency,sort_order",
    "id,code,label,description,amount,currency,sort_order",
    true,
  );

  if (error) {
    return getConfiguredDonationTiers();
  }

  if (!data || data.length === 0) {
    return getConfiguredDonationTiers();
  }

  return mapDonationTierRows(data);
}

export async function getManageableDonationTiers(client: DonationTierClient): Promise<DonationTier[]> {
  const { data, error } = await readDonationTiers(
    client,
    "id,code,label,description,amount,compare_at_amount,currency,sort_order,is_active",
    "id,code,label,description,amount,currency,sort_order,is_active",
    false,
  );

  if (error || !data) {
    return [];
  }

  return mapDonationTierRows(data);
}

export async function findActiveDonationTier(client: DonationTierClient, code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  const tiers = await getActiveDonationTiers(client);

  return tiers.find((tier) => tier.code === code) ?? null;
}
